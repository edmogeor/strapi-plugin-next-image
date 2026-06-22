import * as fsp from 'fs/promises';
import * as path from 'path';
import type { Core } from '@strapi/types';
import { getCacheService } from '../types';
import { isAnimated, getContentTypeFromExt, getExtFromMime, loadSharp } from '../image-utils';

export interface OptimizeParams {
  url: string;
  // True when `url` is an absolute http(s) URL (already allow-listed by the controller).
  isRemote?: boolean;
  width: number;
  quality: number;
  outputFormat: string | null;
  minimumCacheTTL: number;
  dangerouslyAllowSVG: boolean;
}

// A decoded original image plus the metadata needed to name and convert it.
interface ImageSource {
  buffer: Buffer;
  contentType: string;
  basename: string;
}

function httpError(message: string, status: number): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

// Cap remote downloads to avoid memory blowups from hostile/huge upstreams.
const MAX_REMOTE_BYTES = 50 * 1024 * 1024; // 50 MB
const REMOTE_FETCH_TIMEOUT_MS = 10_000;

// Fetch an allow-listed remote image. Throws an Error with `.status` on failure.
async function fetchRemoteImage(url: string): Promise<ImageSource> {
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(REMOTE_FETCH_TIMEOUT_MS) });
  } catch {
    throw httpError(`Failed to fetch remote image: ${url}`, 502);
  }
  if (!res.ok) {
    throw httpError(`Remote image responded with ${res.status}`, res.status === 404 ? 404 : 502);
  }

  const arrayBuf = await res.arrayBuffer();
  if (arrayBuf.byteLength > MAX_REMOTE_BYTES) {
    throw httpError('Remote image exceeds maximum allowed size', 400);
  }

  const pathname = new URL(url).pathname;
  const ext = path.extname(pathname);
  const contentType =
    res.headers.get('content-type')?.split(';')[0].trim() || getContentTypeFromExt(ext);
  return {
    buffer: Buffer.from(arrayBuf),
    contentType,
    basename: path.basename(pathname, ext) || 'image',
  };
}

// Read a local upload from `public/`. Throws a 404 Error if the file is missing.
async function readLocalImage(url: string): Promise<ImageSource> {
  const filePath = path.join(process.cwd(), 'public', url);
  try {
    await fsp.access(filePath);
  } catch {
    throw httpError(`Image not found: ${url}`, 404);
  }
  const ext = path.extname(url);
  return {
    buffer: await fsp.readFile(filePath),
    contentType: getContentTypeFromExt(ext),
    basename: path.basename(url, ext),
  };
}

// fallow-ignore-next-line unused-type
export interface OptimizeResult {
  buffer: Buffer;
  contentType: string;
  etag: string;
  filename: string;
}

// Track in-flight revalidations to avoid duplicate background work
const revalidating = new Set<string>();

// De-duplicate concurrent cold-cache requests for the same image variant
const inFlight = new Map<string, Promise<OptimizeResult>>();

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  // Optimize an image: resize, convert format, and cache the result. Stale cache
  // entries are served immediately while a background re-optimization refreshes them.
  async optimize(params: OptimizeParams): Promise<OptimizeResult> {
    const { url, width, quality, outputFormat } = params;

    const cacheService = getCacheService(strapi);

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

    // --- No cache entry — de-duplicate concurrent requests for the same variant ---
    const inflightKey = `${url}|${width}|${quality}|${formatKey}`;
    let promise = inFlight.get(inflightKey);
    if (!promise) {
      promise = this._optimizeAndCache(params).finally(() => inFlight.delete(inflightKey));
      inFlight.set(inflightKey, promise);
    }
    return promise;
  },

  // Background revalidation: errors are logged, never propagated to the caller.
  async _revalidate(params: OptimizeParams): Promise<void> {
    try {
      await this._optimizeAndCache(params);
    } catch (err) {
      strapi.log.error('Background revalidation failed:', err);
    }
  },

  // Read the original file, optimize it with Sharp, and write to cache.
  async _optimizeAndCache(params: OptimizeParams): Promise<OptimizeResult> {
    const { url, isRemote, width, quality, outputFormat, minimumCacheTTL, dangerouslyAllowSVG } =
      params;

    const cacheService = getCacheService(strapi);
    const formatKey = outputFormat || 'original';

    // --- Read the original image (remote allow-listed URL or local uploads file) ---
    const {
      buffer: originalBuffer,
      basename,
      contentType: originalContentType,
    } = isRemote ? await fetchRemoteImage(url) : await readLocalImage(url);

    // --- SVG handling ---
    if (originalContentType === 'image/svg+xml') {
      if (!dangerouslyAllowSVG) {
        // Serve SVG as-is
        const { etag } = await cacheService.set(
          url,
          width,
          quality,
          formatKey,
          originalBuffer,
          'svg',
          minimumCacheTTL,
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
        url,
        width,
        quality,
        formatKey,
        originalBuffer,
        extension,
        minimumCacheTTL,
      );
      return {
        buffer: originalBuffer,
        contentType: originalContentType,
        etag,
        filename: `${basename}.${extension}`,
      };
    }

    // --- Optimize with sharp ---
    let sharp: Awaited<ReturnType<typeof loadSharp>>;
    try {
      sharp = await loadSharp();
    } catch {
      const err = new Error('sharp is required for image optimization') as Error & {
        status: number;
      };
      err.status = 500;
      throw err;
    }

    let pipeline = sharp(originalBuffer).resize(width, undefined, {
      withoutEnlargement: true,
    });

    let finalContentType: string;

    if (outputFormat === 'image/avif') {
      // AVIF: quality offset of -20, matching Next.js behavior
      const avifQuality = Math.max(quality - 20, 1);
      pipeline = pipeline.avif({ quality: avifQuality });
      finalContentType = 'image/avif';
    } else if (outputFormat === 'image/webp') {
      pipeline = pipeline.webp({ quality });
      finalContentType = 'image/webp';
    } else if (originalContentType === 'image/png') {
      pipeline = pipeline.png({ quality });
      finalContentType = 'image/png';
    } else if (originalContentType === 'image/gif') {
      pipeline = pipeline.gif();
      finalContentType = 'image/gif';
    } else {
      // Default to JPEG
      pipeline = pipeline.jpeg({ quality });
      finalContentType = 'image/jpeg';
    }
    const finalExtension = getExtFromMime(finalContentType);

    const optimizedBuffer = await pipeline.toBuffer();

    // --- Write to cache ---
    const { etag } = await cacheService.set(
      url,
      width,
      quality,
      formatKey,
      optimizedBuffer,
      finalExtension,
      minimumCacheTTL,
    );

    return {
      buffer: optimizedBuffer,
      contentType: finalContentType,
      etag,
      filename: `${basename}.${finalExtension}`,
    };
  },
});
