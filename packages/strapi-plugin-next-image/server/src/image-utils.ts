import type sharpType from 'sharp';

type SharpFn = typeof sharpType;

let sharpPromise: Promise<SharpFn> | null = null;

// Load the optional `sharp` dependency, caching the resolved module so repeated
// callers share one dynamic import. Throws if sharp is not installed — callers
// must catch and degrade.
export function loadSharp(): Promise<SharpFn> {
  if (!sharpPromise) {
    sharpPromise = import('sharp').then((mod) => {
      const m = mod as unknown as { default?: SharpFn };
      return m.default ?? (mod as unknown as SharpFn);
    });
  }
  return sharpPromise;
}

// Canonical extension → MIME map. All extension/type lookups in this package
// derive from it, so updating here updates getContentTypeFromExt and getExtFromMime.
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

export function getContentTypeFromExt(ext: string): string {
  return EXT_TO_CONTENT_TYPE[ext.toLowerCase()] || 'application/octet-stream';
}

export function getExtFromMime(mime: string): string {
  for (const [ext, ct] of Object.entries(EXT_TO_CONTENT_TYPE)) {
    if (ct === mime) return ext.replace('.', '');
  }
  return 'bin';
}

// Detect an animated image buffer:
// - GIF: multiple image descriptor bytes (0x2C)
// - WebP: ANIM/ANMF chunk within the first ~1000 bytes
// - PNG (APNG): acTL chunk within the first ~2000 bytes
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
