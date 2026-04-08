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
