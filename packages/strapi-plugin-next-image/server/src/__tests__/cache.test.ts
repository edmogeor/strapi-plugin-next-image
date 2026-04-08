import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Give this test file its own isolated cache directory so it doesn't
// interfere with cache-invalidation.test.ts when both run in parallel workers.
vi.spyOn(process, 'cwd').mockReturnValue(path.join(os.tmpdir(), 'sni-cache-service-test'));

import createCacheService from '../services/cache';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Use a fresh service instance per test to isolate LRU state.
function makeService() {
  return createCacheService();
}

const baseService = makeService();
const cacheDir = baseService.getCacheDir();

/** Manually writes a cache entry to disk with an arbitrary expireAt. */
function seedCacheFile(
  url: string,
  width: number,
  quality: number,
  format: string,
  expireAt: number,
  etag = 'seededEtag',
  ext = 'webp',
  content = 'fake-data',
) {
  const svc = makeService();
  const key = svc.getCacheKey(url, width, quality, format);
  const entryDir = path.join(cacheDir, key);
  fs.mkdirSync(entryDir, { recursive: true });
  fs.writeFileSync(path.join(entryDir, `3600.${expireAt}.${etag}.${ext}`), content);
}

beforeEach(() => {
  fs.mkdirSync(cacheDir, { recursive: true });
});

afterEach(async () => {
  await makeService().clear();
});

// ---------------------------------------------------------------------------
// getCacheKey
// ---------------------------------------------------------------------------

describe('getCacheKey', () => {
  it('returns a 64-char hex SHA-256 hash', () => {
    const key = makeService().getCacheKey('/uploads/a.jpg', 640, 75, 'webp');
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it('differs for different inputs', () => {
    const svc = makeService();
    const k1 = svc.getCacheKey('/uploads/a.jpg', 640, 75, 'webp');
    const k2 = svc.getCacheKey('/uploads/b.jpg', 640, 75, 'webp');
    const k3 = svc.getCacheKey('/uploads/a.jpg', 1080, 75, 'webp');
    const k4 = svc.getCacheKey('/uploads/a.jpg', 640, 90, 'webp');
    const k5 = svc.getCacheKey('/uploads/a.jpg', 640, 75, 'avif');
    expect(new Set([k1, k2, k3, k4, k5]).size).toBe(5);
  });

  it('is deterministic', () => {
    const svc = makeService();
    expect(svc.getCacheKey('/uploads/a.jpg', 640, 75, 'webp')).toBe(
      svc.getCacheKey('/uploads/a.jpg', 640, 75, 'webp'),
    );
  });
});

// ---------------------------------------------------------------------------
// set
// ---------------------------------------------------------------------------

describe('set', () => {
  it('writes a single file to disk and returns a 16-char hex etag', async () => {
    const svc = makeService();
    const { etag } = await svc.set(
      '/uploads/img.jpg',
      640,
      75,
      'webp',
      Buffer.from('hi'),
      'webp',
      3600,
    );

    expect(etag).toMatch(/^[0-9a-f]{16}$/);
    const key = svc.getCacheKey('/uploads/img.jpg', 640, 75, 'webp');
    const files = fs.readdirSync(path.join(cacheDir, key));
    expect(files).toHaveLength(1);
    expect(files[0]).toContain(etag);
    expect(files[0]).toMatch(/\.webp$/);
  });

  it('overwrites an existing entry (only one file per variant)', async () => {
    const svc = makeService();
    await svc.set('/uploads/img.jpg', 640, 75, 'webp', Buffer.from('v1'), 'webp', 3600);
    await svc.set('/uploads/img.jpg', 640, 75, 'webp', Buffer.from('v2'), 'webp', 3600);

    const key = svc.getCacheKey('/uploads/img.jpg', 640, 75, 'webp');
    expect(fs.readdirSync(path.join(cacheDir, key))).toHaveLength(1);
  });

  it('encodes maxAge and expireAt in the filename', async () => {
    const before = Date.now();
    const svc = makeService();
    const { etag } = await svc.set(
      '/uploads/img.jpg',
      640,
      75,
      'avif',
      Buffer.from('x'),
      'avif',
      7200,
    );
    const after = Date.now();

    const key = svc.getCacheKey('/uploads/img.jpg', 640, 75, 'avif');
    const [filename] = fs.readdirSync(path.join(cacheDir, key));
    const parts = filename.split('.');
    expect(parseInt(parts[0], 10)).toBe(7200);
    const expireAt = parseInt(parts[1], 10);
    expect(expireAt).toBeGreaterThanOrEqual(before + 7200 * 1000);
    expect(expireAt).toBeLessThanOrEqual(after + 7200 * 1000);
    expect(parts[2]).toBe(etag);
  });

  it('keeps different variants independent', async () => {
    const svc = makeService();
    await svc.set('/uploads/img.jpg', 640, 75, 'webp', Buffer.from('a'), 'webp', 3600);
    await svc.set('/uploads/img.jpg', 1080, 75, 'webp', Buffer.from('b'), 'webp', 3600);
    await svc.set('/uploads/img.jpg', 640, 90, 'avif', Buffer.from('c'), 'avif', 3600);

    const count = fs.readdirSync(cacheDir).length;
    expect(count).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// get
// ---------------------------------------------------------------------------

describe('get', () => {
  it('returns null on a cache miss', async () => {
    expect(await makeService().get('/uploads/missing.jpg', 640, 75, 'webp')).toBeNull();
  });

  it('returns the entry from LRU after set (same service instance)', async () => {
    const svc = makeService();
    const buf = Buffer.from('cached-bytes');
    const { etag } = await svc.set('/uploads/img.jpg', 640, 75, 'webp', buf, 'webp', 3600);

    const result = await svc.get('/uploads/img.jpg', 640, 75, 'webp');
    expect(result).not.toBeNull();
    expect(result!.buffer).toEqual(buf);
    expect(result!.etag).toBe(etag);
    expect(result!.contentType).toBe('image/webp');
    expect(result!.extension).toBe('webp');
    expect(result!.isStale).toBe(false);
  });

  it('reads the entry from disk when the LRU is cold (fresh service instance)', async () => {
    const writer = makeService();
    const buf = Buffer.from('disk-bytes');
    const { etag } = await writer.set('/uploads/img.jpg', 640, 75, 'webp', buf, 'webp', 3600);

    const reader = makeService(); // empty LRU → hits disk
    const result = await reader.get('/uploads/img.jpg', 640, 75, 'webp');
    expect(result).not.toBeNull();
    expect(result!.buffer).toEqual(buf);
    expect(result!.etag).toBe(etag);
    expect(result!.isStale).toBe(false);
  });

  it('reports isStale=true for an entry with a past expireAt', async () => {
    // Seed a file with expireAt=1 (epoch ms — definitely in the past)
    seedCacheFile('/uploads/stale.jpg', 640, 75, 'webp', 1, 'staleEtag');

    const result = await makeService().get('/uploads/stale.jpg', 640, 75, 'webp');
    expect(result).not.toBeNull();
    expect(result!.isStale).toBe(true);
    expect(result!.etag).toBe('staleEtag');
  });

  it('maps file extensions to correct content types', async () => {
    const svc = makeService();
    const cases: [string, string][] = [
      ['avif', 'image/avif'],
      ['png', 'image/png'],
      ['jpg', 'image/jpeg'],
      ['jpeg', 'image/jpeg'],
      ['gif', 'image/gif'],
      ['svg', 'image/svg+xml'],
    ];
    for (const [ext, contentType] of cases) {
      await svc.set('/uploads/img.jpg', 640, 75, ext, Buffer.from('x'), ext, 3600);
      const result = await svc.get('/uploads/img.jpg', 640, 75, ext);
      expect(result!.contentType).toBe(contentType);
    }
  });

  it('does not promote stale disk entries into LRU', async () => {
    seedCacheFile('/uploads/stale.jpg', 640, 75, 'webp', 1, 'staleEtag');

    const svc = makeService();
    // First read — goes to disk, stale → not promoted to LRU
    await svc.get('/uploads/stale.jpg', 640, 75, 'webp');

    // Delete the disk entry; a subsequent get should now return null
    const key = svc.getCacheKey('/uploads/stale.jpg', 640, 75, 'webp');
    fs.rmSync(path.join(cacheDir, key), { recursive: true, force: true });

    const result2 = await svc.get('/uploads/stale.jpg', 640, 75, 'webp');
    expect(result2).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// peekEtag
// ---------------------------------------------------------------------------

describe('peekEtag', () => {
  it('returns null when no entry exists', async () => {
    expect(await makeService().peekEtag('/uploads/missing.jpg', 640, 75, 'webp')).toBeNull();
  });

  it('returns etag and isStale=false from LRU for a fresh entry', async () => {
    const svc = makeService();
    const { etag } = await svc.set(
      '/uploads/img.jpg',
      640,
      75,
      'webp',
      Buffer.from('x'),
      'webp',
      3600,
    );

    const peek = await svc.peekEtag('/uploads/img.jpg', 640, 75, 'webp');
    expect(peek).not.toBeNull();
    expect(peek!.etag).toBe(etag);
    expect(peek!.isStale).toBe(false);
  });

  it('reads etag from disk when LRU is cold', async () => {
    const writer = makeService();
    const { etag } = await writer.set(
      '/uploads/img.jpg',
      640,
      75,
      'webp',
      Buffer.from('x'),
      'webp',
      3600,
    );

    const reader = makeService(); // cold LRU
    const peek = await reader.peekEtag('/uploads/img.jpg', 640, 75, 'webp');
    expect(peek).not.toBeNull();
    expect(peek!.etag).toBe(etag);
  });

  it('reports isStale=true for an entry with a past expireAt', async () => {
    seedCacheFile('/uploads/stale.jpg', 640, 75, 'webp', 1, 'staleEtag');

    const peek = await makeService().peekEtag('/uploads/stale.jpg', 640, 75, 'webp');
    expect(peek!.isStale).toBe(true);
    expect(peek!.etag).toBe('staleEtag');
  });

  it('returns null for an empty entry directory', async () => {
    const svc = makeService();
    const key = svc.getCacheKey('/uploads/img.jpg', 640, 75, 'webp');
    fs.mkdirSync(path.join(cacheDir, key), { recursive: true }); // empty dir
    expect(await svc.peekEtag('/uploads/img.jpg', 640, 75, 'webp')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// clear
// ---------------------------------------------------------------------------

describe('clear', () => {
  it('removes the entire cache directory from disk', async () => {
    const svc = makeService();
    await svc.set('/uploads/a.jpg', 640, 75, 'webp', Buffer.from('x'), 'webp', 3600);
    await svc.set('/uploads/b.jpg', 1080, 75, 'avif', Buffer.from('y'), 'avif', 3600);

    await svc.clear();
    expect(fs.existsSync(cacheDir)).toBe(false);
  });

  it('makes subsequent gets return null', async () => {
    const svc = makeService();
    await svc.set('/uploads/img.jpg', 640, 75, 'webp', Buffer.from('x'), 'webp', 3600);
    await svc.clear();
    expect(await svc.get('/uploads/img.jpg', 640, 75, 'webp')).toBeNull();
  });

  it('is a no-op when the cache directory does not exist', async () => {
    const svc = makeService();
    fs.rmSync(cacheDir, { recursive: true, force: true });
    await expect(svc.clear()).resolves.toBeUndefined();
  });
});
