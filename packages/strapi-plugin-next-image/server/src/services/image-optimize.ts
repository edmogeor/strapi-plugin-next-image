import * as fs from 'fs';
import * as path from 'path';
import type { Core } from '@strapi/types';

export interface OptimizeParams {
  url: string;
  width: number;
  quality: number;
  outputFormat: string | null;
  minimumCacheTTL: number;
  dangerouslyAllowSVG: boolean;
}

export interface OptimizeResult {
  buffer: Buffer;
  contentType: string;
  etag: string;
  filename: string;
}

function getService(strapi: Core.Strapi, name: string) {
  return strapi.plugin('next-image').service(name);
}

/**
 * Detect if an image is animated (GIF, animated WebP/PNG).
 * For GIF, check for multiple image blocks.
 * For WebP, check for ANIM chunk.
 * For PNG, check for acTL chunk (APNG).
 */
function isAnimated(buffer: Buffer, contentType: string): boolean {
  if (contentType === 'image/gif') {
    // GIF: look for multiple image descriptors (0x2C)
    let count = 0;
    for (let i = 0; i < buffer.length - 1; i++) {
      if (buffer[i] === 0x2c) {
        count++;
        if (count > 1) return true;
      }
    }
    return false;
  }

  if (contentType === 'image/webp') {
    // WebP: look for ANIM or ANMF chunk
    const str = buffer.toString('ascii', 0, Math.min(buffer.length, 40));
    if (str.includes('ANIM') || str.includes('ANMF')) return true;
    // Also scan further in the buffer
    for (let i = 0; i < Math.min(buffer.length - 4, 1000); i++) {
      if (
        buffer[i] === 0x41 && // A
        buffer[i + 1] === 0x4e && // N
        buffer[i + 2] === 0x4d && // M
        (buffer[i + 3] === 0x46 || buffer[i + 3] === 0x00) // F or null
      ) {
        return true;
      }
    }
    return false;
  }

  if (contentType === 'image/png') {
    // APNG: look for acTL chunk
    for (let i = 0; i < Math.min(buffer.length - 4, 2000); i++) {
      if (
        buffer[i] === 0x61 && // a
        buffer[i + 1] === 0x63 && // c
        buffer[i + 2] === 0x54 && // T
        buffer[i + 3] === 0x4c // L
      ) {
        return true;
      }
    }
    return false;
  }

  return false;
}

function getContentTypeFromExt(ext: string): string {
  const map: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.bmp': 'image/bmp',
    '.tiff': 'image/tiff',
  };
  return map[ext.toLowerCase()] || 'application/octet-stream';
}

function getExtFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/avif': 'avif',
    'image/svg+xml': 'svg',
    'image/x-icon': 'ico',
    'image/bmp': 'bmp',
    'image/tiff': 'tiff',
  };
  return map[mime] || 'bin';
}

// Track in-flight revalidations to avoid duplicate work
const revalidating = new Set<string>();

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * Optimize an image: resize, convert format, and cache the result.
   * Uses stale-while-revalidate: expired cache entries are served immediately
   * while a background re-optimization refreshes the cache for the next request.
   */
  async optimize(params: OptimizeParams): Promise<OptimizeResult> {
    const { url, width, quality, outputFormat, minimumCacheTTL, dangerouslyAllowSVG } = params;

    const cacheService = getService(strapi, 'cache');

    // Determine the effective output format string for cache key
    const formatKey = outputFormat || 'original';

    // --- Check cache ---
    const cached = await cacheService.get(url, width, quality, formatKey);
    if (cached) {
      // Stale-while-revalidate: serve the stale entry immediately,
      // then re-optimize in the background so the next request gets fresh data.
      if (cached.isStale) {
        const revalKey = `${url}|${width}|${quality}|${formatKey}`;
        if (!revalidating.has(revalKey)) {
          revalidating.add(revalKey);
          this._revalidate(params).finally(() => revalidating.delete(revalKey));
        }
      }

      const basename = path.basename(url, path.extname(url));
      return {
        buffer: cached.buffer,
        contentType: cached.contentType,
        etag: cached.etag,
        filename: `${basename}.${cached.extension}`,
      };
    }

    // --- No cache entry — optimize synchronously ---
    return this._optimizeAndCache(params);
  },

  /**
   * Background revalidation: re-optimize and update the cache.
   * Errors are logged but never propagated to the caller.
   */
  async _revalidate(params: OptimizeParams): Promise<void> {
    try {
      await this._optimizeAndCache(params);
    } catch (err) {
      strapi.log.error('Background revalidation failed:', err);
    }
  },

  /**
   * Read the original file, optimize it with Sharp, and write to cache.
   */
  async _optimizeAndCache(params: OptimizeParams): Promise<OptimizeResult> {
    const { url, width, quality, outputFormat, minimumCacheTTL, dangerouslyAllowSVG } = params;

    const cacheService = getService(strapi, 'cache');
    const formatKey = outputFormat || 'original';

    // --- Read original image from uploads directory ---
    const uploadsDir = path.join(process.cwd(), 'public');
    const filePath = path.join(uploadsDir, url);

    if (!fs.existsSync(filePath)) {
      const err = new Error(`Image not found: ${url}`) as Error & { status: number };
      err.status = 404;
      throw err;
    }

    const originalBuffer = fs.readFileSync(filePath);
    const ext = path.extname(url);
    const basename = path.basename(url, ext);
    const originalContentType = getContentTypeFromExt(ext);

    // --- SVG handling ---
    if (originalContentType === 'image/svg+xml') {
      if (!dangerouslyAllowSVG) {
        // Serve SVG as-is
        const { etag } = await cacheService.set(
          url, width, quality, formatKey,
          originalBuffer, 'svg', minimumCacheTTL
        );
        return {
          buffer: originalBuffer,
          contentType: 'image/svg+xml',
          etag,
          filename: `${basename}.svg`,
        };
      }
    }

    // --- Animated image handling ---
    if (isAnimated(originalBuffer, originalContentType)) {
      // Serve animated images as-is
      const extension = getExtFromMime(originalContentType);
      const { etag } = await cacheService.set(
        url, width, quality, formatKey,
        originalBuffer, extension, minimumCacheTTL
      );
      return {
        buffer: originalBuffer,
        contentType: originalContentType,
        etag,
        filename: `${basename}.${extension}`,
      };
    }

    // --- Optimize with sharp ---
    let sharpFn: (input: Buffer) => import('sharp').Sharp;
    try {
      const sharpModule = require('sharp');
      sharpFn = sharpModule.default || sharpModule;
    } catch {
      const err = new Error('sharp is required for image optimization') as Error & { status: number };
      err.status = 500;
      throw err;
    }

    let pipeline = sharpFn(originalBuffer).resize(width, undefined, {
      withoutEnlargement: true,
    });

    let finalContentType: string;
    let finalExtension: string;

    if (outputFormat === 'image/avif') {
      // AVIF: quality offset of -20, matching Next.js behavior
      const avifQuality = Math.max(quality - 20, 1);
      pipeline = pipeline.avif({ quality: avifQuality });
      finalContentType = 'image/avif';
      finalExtension = 'avif';
    } else if (outputFormat === 'image/webp') {
      pipeline = pipeline.webp({ quality });
      finalContentType = 'image/webp';
      finalExtension = 'webp';
    } else if (originalContentType === 'image/png') {
      pipeline = pipeline.png({ quality });
      finalContentType = 'image/png';
      finalExtension = 'png';
    } else if (originalContentType === 'image/gif') {
      pipeline = pipeline.gif();
      finalContentType = 'image/gif';
      finalExtension = 'gif';
    } else {
      // Default to JPEG
      pipeline = pipeline.jpeg({ quality });
      finalContentType = 'image/jpeg';
      finalExtension = 'jpg';
    }

    const optimizedBuffer = await pipeline.toBuffer();

    // --- Write to cache ---
    const { etag } = await cacheService.set(
      url, width, quality, formatKey,
      optimizedBuffer, finalExtension, minimumCacheTTL
    );

    return {
      buffer: optimizedBuffer,
      contentType: finalContentType,
      etag,
      filename: `${basename}.${finalExtension}`,
    };
  },
});
