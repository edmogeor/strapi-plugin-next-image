import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

// fallow-ignore-next-line unused-type
export interface CacheEntry {
  buffer: Buffer;
  contentType: string;
  etag: string;
  extension: string;
  isStale: boolean;
  expireAt: number;
}

interface CacheMetadata {
  maxAge: number;
  expireAt: number;
  etag: string;
  extension: string;
}

const extToContentType: Record<string, string> = {
  webp: 'image/webp',
  avif: 'image/avif',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
};

class LRUCache<K, V> {
  private map = new Map<K, V>();

  constructor(private maxSize: number) {}

  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key)!;
    // Move to end (most recently used)
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxSize) {
      // Evict least recently used (first entry)
      this.map.delete(this.map.keys().next().value!);
    }
    this.map.set(key, value);
  }

  delete(key: K): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }
}

function getCacheDir(): string {
  return path.join(process.cwd(), '.cache', 'next-image');
}

function getCacheKey(url: string, width: number, quality: number, format: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(`${url}|${width}|${quality}|${format}`);
  return hash.digest('hex');
}

function parseCacheFilename(filename: string): CacheMetadata | null {
  // Format: {maxAge}.{expireAt}.{etag}.{extension}
  const parts = filename.split('.');
  if (parts.length < 4) return null;

  return {
    maxAge: parseInt(parts[0], 10),
    expireAt: parseInt(parts[1], 10),
    etag: parts[2],
    extension: parts.slice(3).join('.'),
  };
}

interface DiskEntry {
  entryDir: string;
  filename: string;
  meta: CacheMetadata;
}

async function readDiskEntry(key: string): Promise<DiskEntry | null> {
  const entryDir = path.join(getCacheDir(), key);
  let files: string[];
  try {
    files = await fsp.readdir(entryDir);
  } catch {
    return null;
  }
  if (files.length === 0) return null;

  const filename = files[0];
  const meta = parseCacheFilename(filename);
  if (!meta) return null;

  return { entryDir, filename, meta };
}

import type { PluginConfig } from '../types';

export type InvalidateConfig = Pick<
  PluginConfig,
  'deviceSizes' | 'imageSizes' | 'qualities' | 'formats'
>;

export default () => {
  const memCache = new LRUCache<string, CacheEntry>(200);

  return {
    getCacheDir,
    getCacheKey,

    invalidateUrl(url: string, config: InvalidateConfig): void {
      const cacheDir = getCacheDir();
      const diskExists = fs.existsSync(cacheDir);

      const allWidths = [...config.deviceSizes, ...config.imageSizes];
      const formatKeys = [...config.formats.map((f) => f.replace('image/', '')), 'original'];

      for (const width of allWidths) {
        for (const quality of config.qualities) {
          for (const format of formatKeys) {
            const key = getCacheKey(url, width, quality, format);
            memCache.delete(key);
            if (diskExists) {
              const entryDir = path.join(cacheDir, key);
              fs.rmSync(entryDir, { recursive: true, force: true });
            }
          }
        }
      }
    },

    /**
     * Return the cached ETag and staleness for a variant without reading the
     * image buffer. Used for fast If-None-Match 304 checks.
     */
    async peekEtag(
      url: string,
      width: number,
      quality: number,
      format: string,
    ): Promise<{ etag: string; isStale: boolean } | null> {
      const key = getCacheKey(url, width, quality, format);

      // LRU hit — no disk I/O
      const memEntry = memCache.get(key);
      if (memEntry) {
        return { etag: memEntry.etag, isStale: Date.now() > memEntry.expireAt };
      }

      // Disk: readdir only, no readFile
      const disk = await readDiskEntry(key);
      if (!disk) return null;

      return { etag: disk.meta.etag, isStale: Date.now() > disk.meta.expireAt };
    },

    async get(
      url: string,
      width: number,
      quality: number,
      format: string,
    ): Promise<CacheEntry | null> {
      const key = getCacheKey(url, width, quality, format);

      // LRU hit — no disk I/O
      const memEntry = memCache.get(key);
      if (memEntry) {
        // Recompute isStale with current time (entry may have aged in memory)
        return { ...memEntry, isStale: Date.now() > memEntry.expireAt };
      }

      // Disk hit
      const disk = await readDiskEntry(key);
      if (!disk) return null;

      const isStale = Date.now() > disk.meta.expireAt;
      const buffer = await fsp.readFile(path.join(disk.entryDir, disk.filename));

      const entry: CacheEntry = {
        buffer,
        contentType: extToContentType[disk.meta.extension] || 'application/octet-stream',
        etag: disk.meta.etag,
        extension: disk.meta.extension,
        isStale,
        expireAt: disk.meta.expireAt,
      };

      // Only promote non-stale entries to LRU
      if (!isStale) {
        memCache.set(key, entry);
      }

      return entry;
    },

    async set(
      url: string,
      width: number,
      quality: number,
      format: string,
      buffer: Buffer,
      extension: string,
      maxAge: number,
    ): Promise<{ etag: string }> {
      const key = getCacheKey(url, width, quality, format);
      const entryDir = path.join(getCacheDir(), key);

      await fsp.rm(entryDir, { recursive: true, force: true });
      await fsp.mkdir(entryDir, { recursive: true });

      const etag = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16);
      const expireAt = Date.now() + maxAge * 1000;
      const filename = `${maxAge}.${expireAt}.${etag}.${extension}`;

      await fsp.writeFile(path.join(entryDir, filename), buffer);

      // Update LRU with fresh entry
      memCache.set(key, {
        buffer,
        contentType: extToContentType[extension] || 'application/octet-stream',
        etag,
        extension,
        isStale: false,
        expireAt,
      });

      return { etag };
    },

    async clear(): Promise<void> {
      memCache.clear();
      const cacheDir = getCacheDir();
      if (fs.existsSync(cacheDir)) {
        await fsp.rm(cacheDir, { recursive: true, force: true });
      }
    },
  };
};
