import type sharpType from 'sharp';

type SharpFn = typeof sharpType;

let sharpPromise: Promise<SharpFn> | null = null;

/**
 * Load the optional `sharp` dependency, caching the resolved module so repeated
 * callers share one dynamic import. Throws if sharp is not installed — callers
 * are responsible for catching and degrading appropriately.
 */
export function loadSharp(): Promise<SharpFn> {
  if (!sharpPromise) {
    sharpPromise = import('sharp').then((mod) => {
      const m = mod as unknown as { default?: SharpFn };
      return m.default ?? (mod as unknown as SharpFn);
    });
  }
  return sharpPromise;
}

/**
 * Canonical map of file extension → MIME content type.
 * All other extension/type lookups in this package derive from this map.
 * Updating the list here updates getContentTypeFromExt, getExtFromMime,
 * and the cache service's extToContentType simultaneously.
 */
const EXT_TO_CONTENT_TYPE: Record<string, string> = {
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

/**
 * Derive content type from file extension.
 */
export function getContentTypeFromExt(ext: string): string {
  return EXT_TO_CONTENT_TYPE[ext.toLowerCase()] || 'application/octet-stream';
}

/**
 * Derive file extension from MIME content type.
 */
export function getExtFromMime(mime: string): string {
  for (const [ext, ct] of Object.entries(EXT_TO_CONTENT_TYPE)) {
    if (ct === mime) return ext.replace('.', '');
  }
  return 'bin';
}

/**
 * Detect if an image buffer is animated (multi-frame GIF, animated WebP/PNG).
 *
 * - GIF: looks for multiple image descriptor bytes (0x2C).
 * - WebP: looks for ANIM/ANMF chunk within the first ~1 000 bytes.
 * - PNG (APNG): looks for acTL chunk within the first ~2 000 bytes.
 */
export function isAnimated(buffer: Buffer, contentType: string): boolean {
  if (contentType === 'image/gif') {
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
