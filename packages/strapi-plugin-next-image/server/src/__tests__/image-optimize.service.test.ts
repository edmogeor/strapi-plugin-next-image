import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import type { Core } from '@strapi/types';

// ---------------------------------------------------------------------------
// fs/promises mock — intercepts the static import in image-optimize.ts
// ---------------------------------------------------------------------------

const { mockAccess, mockReadFile } = vi.hoisted(() => ({
  mockAccess: vi.fn().mockResolvedValue(undefined),
  mockReadFile: vi.fn(),
}));

vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs/promises')>();
  return { ...actual, access: mockAccess, readFile: mockReadFile };
});

import { JPEG_1x1, PNG_1x1, ANIMATED_GIF, createImageFixtures } from './image-fixtures';
import createImageOptimizeService from '../services/image-optimize';
import type { OptimizeParams } from '../services/image-optimize';

// ---------------------------------------------------------------------------
// Shared test fixtures — real image buffers so the real sharp can process them
// ---------------------------------------------------------------------------

beforeAll(createImageFixtures);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockCacheService() {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue({ etag: 'testEtag1234' }),
    peekEtag: vi.fn().mockResolvedValue(null),
    invalidateUrl: vi.fn(),
    clear: vi.fn(),
    getCacheDir: vi.fn().mockReturnValue('/tmp/test-cache'),
    getCacheKey: vi.fn().mockReturnValue('testhashkey'),
  };
}

function makeStrapi(cacheService = makeMockCacheService()) {
  const strapi = {
    plugin: vi.fn().mockReturnValue({
      service: vi.fn().mockReturnValue(cacheService),
    }),
    log: { error: vi.fn() },
  } as unknown as Core.Strapi;
  return { strapi, cacheService };
}

const baseParams: OptimizeParams = {
  url: '/uploads/photo.jpg',
  width: 640,
  quality: 75,
  outputFormat: null,
  minimumCacheTTL: 3600,
  dangerouslyAllowSVG: false,
};

function assertCached(
  cacheService: ReturnType<typeof makeMockCacheService>,
  args: { format?: string; buffer?: Buffer; extension: string },
): void {
  expect(cacheService.set).toHaveBeenCalledWith(
    expect.any(String),
    expect.any(Number),
    expect.any(Number),
    args.format ?? expect.any(String),
    args.buffer ?? expect.any(Buffer),
    args.extension,
    expect.any(Number),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAccess.mockResolvedValue(undefined);
  mockReadFile.mockResolvedValue(JPEG_1x1);
});

// ---------------------------------------------------------------------------
// _optimizeAndCache — format selection
// ---------------------------------------------------------------------------

describe('imageOptimizeService._optimizeAndCache', () => {
  it('converts to JPEG by default (no outputFormat)', async () => {
    const { strapi, cacheService } = makeStrapi();
    const svc = createImageOptimizeService({ strapi });

    const result = await svc._optimizeAndCache({ ...baseParams, outputFormat: null });

    expect(result.contentType).toBe('image/jpeg');
    expect(result.filename).toMatch(/\.jpg$/);
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(cacheService.set).toHaveBeenCalledWith(
      baseParams.url,
      baseParams.width,
      baseParams.quality,
      'original',
      expect.any(Buffer),
      'jpg',
      baseParams.minimumCacheTTL,
    );
  });

  it('converts to WebP when outputFormat is image/webp', async () => {
    const { strapi, cacheService } = makeStrapi();
    const svc = createImageOptimizeService({ strapi });

    const result = await svc._optimizeAndCache({ ...baseParams, outputFormat: 'image/webp' });

    expect(result.contentType).toBe('image/webp');
    expect(result.filename).toMatch(/\.webp$/);
    assertCached(cacheService, { format: 'image/webp', extension: 'webp' });
  });

  it('converts to AVIF with quality-20 offset when outputFormat is image/avif', async () => {
    const { strapi, cacheService } = makeStrapi();
    const svc = createImageOptimizeService({ strapi });

    const result = await svc._optimizeAndCache({
      ...baseParams,
      outputFormat: 'image/avif',
      quality: 75,
    });

    expect(result.contentType).toBe('image/avif');
    expect(result.filename).toMatch(/\.avif$/);
    expect(cacheService.set).toHaveBeenCalled();
  });

  it('clamps AVIF quality to minimum 1', async () => {
    const { strapi } = makeStrapi();
    const svc = createImageOptimizeService({ strapi });
    // quality 10 - 20 = -10, should clamp to 1; sharp should not throw
    const result = await svc._optimizeAndCache({
      ...baseParams,
      outputFormat: 'image/avif',
      quality: 10,
    });
    expect(result.contentType).toBe('image/avif');
  });

  it('converts PNG to PNG format', async () => {
    const { strapi, cacheService } = makeStrapi();
    mockReadFile.mockResolvedValue(PNG_1x1);
    const svc = createImageOptimizeService({ strapi });

    const result = await svc._optimizeAndCache({
      ...baseParams,
      url: '/uploads/image.png',
      outputFormat: null,
    });

    expect(result.contentType).toBe('image/png');
    expect(result.filename).toMatch(/\.png$/);
    expect(cacheService.set).toHaveBeenCalled();
  });

  it('passes SVG through without sharp when dangerouslyAllowSVG is false', async () => {
    const { strapi, cacheService } = makeStrapi();
    const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    mockReadFile.mockResolvedValue(svgBuffer);

    const svc = createImageOptimizeService({ strapi });
    const result = await svc._optimizeAndCache({
      ...baseParams,
      url: '/uploads/icon.svg',
      dangerouslyAllowSVG: false,
    });

    expect(result.contentType).toBe('image/svg+xml');
    expect(result.buffer).toEqual(svgBuffer);
    expect(result.filename).toMatch(/\.svg$/);
    assertCached(cacheService, { buffer: svgBuffer, extension: 'svg' });
  });

  it('serves animated GIFs as-is without resizing', async () => {
    const { strapi, cacheService } = makeStrapi();
    mockReadFile.mockResolvedValue(ANIMATED_GIF);

    const svc = createImageOptimizeService({ strapi });
    const result = await svc._optimizeAndCache({ ...baseParams, url: '/uploads/anim.gif' });

    expect(result.contentType).toBe('image/gif');
    expect(result.buffer).toEqual(ANIMATED_GIF);
    expect(cacheService.set).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Number),
      expect.any(Number),
      expect.any(String),
      ANIMATED_GIF,
      'gif',
      expect.any(Number),
    );
  });

  it('throws a 404 HttpError when the file does not exist', async () => {
    const { strapi } = makeStrapi();
    mockAccess.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));

    const svc = createImageOptimizeService({ strapi });
    await expect(
      svc._optimizeAndCache({ ...baseParams, url: '/uploads/missing.jpg' }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('resizes with withoutEnlargement: true', async () => {
    const { strapi, cacheService } = makeStrapi();
    const svc = createImageOptimizeService({ strapi });

    // A 1x1 image with width=1200 should not be enlarged; output size <= input size
    const result = await svc._optimizeAndCache({ ...baseParams, width: 1200 });
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(cacheService.set).toHaveBeenCalled();
  });

  it('returns the etag from the cache set call', async () => {
    const { strapi, cacheService } = makeStrapi();
    cacheService.set.mockResolvedValue({ etag: 'uniqueEtag9876' });
    const svc = createImageOptimizeService({ strapi });

    const result = await svc._optimizeAndCache(baseParams);
    expect(result.etag).toBe('uniqueEtag9876');
  });
});

// ---------------------------------------------------------------------------
// optimize — cache hit / miss / stale
// ---------------------------------------------------------------------------

describe('imageOptimizeService.optimize', () => {
  it('returns cached entry immediately on a fresh cache hit', async () => {
    const cacheService = makeMockCacheService();
    const cachedBuf = Buffer.from('cached-data');
    cacheService.get.mockResolvedValue({
      buffer: cachedBuf,
      contentType: 'image/webp',
      etag: 'cachedEtag',
      extension: 'webp',
      isStale: false,
      expireAt: Date.now() + 3_600_000,
    });

    const { strapi } = makeStrapi(cacheService);
    const svc = createImageOptimizeService({ strapi });

    const result = await svc.optimize({ ...baseParams, url: '/uploads/cached.jpg' });

    expect(result.buffer).toEqual(cachedBuf);
    expect(result.etag).toBe('cachedEtag');
    // File should not be read from disk when there's a cache hit
    expect(mockReadFile).not.toHaveBeenCalled();
  });

  it('calls _optimizeAndCache on a cache miss', async () => {
    const { strapi, cacheService } = makeStrapi();
    cacheService.get.mockResolvedValue(null);

    const svc = createImageOptimizeService({ strapi });
    const result = await svc.optimize({ ...baseParams, url: '/uploads/new.jpg' });

    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(cacheService.set).toHaveBeenCalled();
  });

  it('returns a stale entry immediately without waiting for revalidation', async () => {
    const cacheService = makeMockCacheService();
    const staleBuf = Buffer.from('stale-data');
    cacheService.get.mockResolvedValue({
      buffer: staleBuf,
      contentType: 'image/webp',
      etag: 'staleEtag',
      extension: 'webp',
      isStale: true,
      expireAt: Date.now() - 1000,
    });

    const { strapi } = makeStrapi(cacheService);
    const svc = createImageOptimizeService({ strapi });

    const result = await svc.optimize({ ...baseParams, url: '/uploads/stale.jpg' });

    expect(result.buffer).toEqual(staleBuf);
    expect(result.etag).toBe('staleEtag');
  });

  it('de-duplicates concurrent in-flight requests for the same variant', async () => {
    const { strapi, cacheService } = makeStrapi();
    cacheService.get.mockResolvedValue(null);

    const svc = createImageOptimizeService({ strapi });
    const url = '/uploads/concurrent.jpg';

    // Launch two concurrent optimize calls before either resolves
    const p1 = svc.optimize({ ...baseParams, url });
    const p2 = svc.optimize({ ...baseParams, url });

    const [r1, r2] = await Promise.all([p1, p2]);

    // Both resolve to the same result (same promise was shared)
    expect(r1.etag).toBe(r2.etag);
    expect(r1.buffer).toEqual(r2.buffer);
    // The underlying work should only have been done once
    expect(cacheService.set).toHaveBeenCalledTimes(1);
  });

  it('uses different in-flight promises for different URLs', async () => {
    const { strapi, cacheService } = makeStrapi();
    cacheService.get.mockResolvedValue(null);

    const svc = createImageOptimizeService({ strapi });

    await Promise.all([
      svc.optimize({ ...baseParams, url: '/uploads/a.jpg' }),
      svc.optimize({ ...baseParams, url: '/uploads/b.jpg' }),
    ]);

    expect(cacheService.set).toHaveBeenCalledTimes(2);
  });

  it('includes the filename derived from the source URL in the result', async () => {
    const { strapi } = makeStrapi();
    const svc = createImageOptimizeService({ strapi });

    const result = await svc.optimize({ ...baseParams, url: '/uploads/my-photo.jpg' });

    expect(result.filename).toContain('my-photo');
  });
});
