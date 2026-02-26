import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface CacheEntry {
  buffer: Buffer;
  contentType: string;
  etag: string;
  extension: string;
}

interface CacheMetadata {
  maxAge: number;
  expireAt: number;
  etag: string;
  extension: string;
}

function getCacheDir(): string {
  return path.join(process.cwd(), '.cache', 'image-optimize');
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

export default () => ({
  getCacheDir,

  async get(
    url: string,
    width: number,
    quality: number,
    format: string
  ): Promise<CacheEntry | null> {
    const key = getCacheKey(url, width, quality, format);
    const entryDir = path.join(getCacheDir(), key);

    if (!fs.existsSync(entryDir)) {
      return null;
    }

    const files = fs.readdirSync(entryDir);
    if (files.length === 0) {
      return null;
    }

    const filename = files[0];
    const meta = parseCacheFilename(filename);
    if (!meta) {
      return null;
    }

    // Check if expired
    const now = Date.now();
    if (now > meta.expireAt) {
      // Clean up expired entry
      fs.rmSync(entryDir, { recursive: true, force: true });
      return null;
    }

    const filePath = path.join(entryDir, filename);
    const buffer = fs.readFileSync(filePath);

    const extToContentType: Record<string, string> = {
      webp: 'image/webp',
      avif: 'image/avif',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      svg: 'image/svg+xml',
    };

    return {
      buffer,
      contentType: extToContentType[meta.extension] || 'application/octet-stream',
      etag: meta.etag,
      extension: meta.extension,
    };
  },

  async set(
    url: string,
    width: number,
    quality: number,
    format: string,
    buffer: Buffer,
    extension: string,
    maxAge: number
  ): Promise<{ etag: string }> {
    const key = getCacheKey(url, width, quality, format);
    const entryDir = path.join(getCacheDir(), key);

    // Ensure the directory exists (clean any old entry)
    fs.rmSync(entryDir, { recursive: true, force: true });
    fs.mkdirSync(entryDir, { recursive: true });

    const etag = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16);
    const expireAt = Date.now() + maxAge * 1000;
    const filename = `${maxAge}.${expireAt}.${etag}.${extension}`;

    fs.writeFileSync(path.join(entryDir, filename), buffer);

    return { etag };
  },

  async clear(): Promise<void> {
    const cacheDir = getCacheDir();
    if (fs.existsSync(cacheDir)) {
      fs.rmSync(cacheDir, { recursive: true, force: true });
    }
  },
});
