import * as fs from 'fs';
import * as path from 'path';
import type { Core } from '@strapi/types';

const SUPPORTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
]);

/**
 * Detect if an image buffer is animated (multi-frame GIF, animated WebP/PNG).
 */
function isAnimated(buffer: Buffer, mime: string): boolean {
  if (mime === 'image/gif') {
    let count = 0;
    for (let i = 0; i < buffer.length - 1; i++) {
      if (buffer[i] === 0x2c) {
        count++;
        if (count > 1) return true;
      }
    }
    return false;
  }

  if (mime === 'image/webp') {
    for (let i = 0; i < Math.min(buffer.length - 4, 1000); i++) {
      if (
        buffer[i] === 0x41 &&
        buffer[i + 1] === 0x4e &&
        buffer[i + 2] === 0x4d &&
        (buffer[i + 3] === 0x46 || buffer[i + 3] === 0x00)
      ) {
        return true;
      }
    }
    return false;
  }

  if (mime === 'image/png') {
    for (let i = 0; i < Math.min(buffer.length - 4, 2000); i++) {
      if (
        buffer[i] === 0x61 &&
        buffer[i + 1] === 0x63 &&
        buffer[i + 2] === 0x54 &&
        buffer[i + 3] === 0x4c
      ) {
        return true;
      }
    }
    return false;
  }

  return false;
}

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * Generate a tiny base64-encoded blur placeholder for an image file.
   * Returns a data URL string or null if the file can't be processed.
   */
  async generate(fileUrl: string, mime: string): Promise<string | null> {
    if (!SUPPORTED_MIME_TYPES.has(mime)) {
      return null;
    }

    const filePath = path.join(process.cwd(), 'public', fileUrl);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const buffer = fs.readFileSync(filePath);

    if (isAnimated(buffer, mime)) {
      return null;
    }

    const pluginConfig = strapi.config.get('plugin::next-image') as {
      blurSize?: number;
    };
    const blurSize = pluginConfig.blurSize || 8;

    let sharpFn: (input: Buffer) => import('sharp').Sharp;
    try {
      const sharpModule = require('sharp');
      sharpFn = sharpModule.default || sharpModule;
    } catch {
      strapi.log.warn('sharp is required for blur placeholder generation');
      return null;
    }

    try {
      const tiny = await sharpFn(buffer)
        .resize(blurSize, undefined, { withoutEnlargement: true })
        .jpeg({ quality: 70 })
        .toBuffer();

      return `data:image/jpeg;base64,${tiny.toString('base64')}`;
    } catch (err) {
      strapi.log.error('Failed to generate blur placeholder:', err);
      return null;
    }
  },
});
