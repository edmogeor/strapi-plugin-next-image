import * as fsp from 'fs/promises';
import * as path from 'path';
import type { Core } from '@strapi/types';
import { getUploadFileRepository, type PluginConfig } from '../types';
import { isAnimated, loadSharp } from '../image-utils';

const SUPPORTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
]);

// Written to `blurDataURL` after a failed generation so the backfill skips the
// row next boot. Stays falsy for `if (file.blurDataURL)` checks downstream.
export const BLUR_SKIP_SENTINEL = '';

export default ({ strapi }: { strapi: Core.Strapi }) => {
  // URLs confirmed to have a blurDataURL — skip DB lookup on future requests.
  const blurChecked = new Set<string>();
  // URLs for which blur generation is currently in-progress — prevents duplicate work.
  const blurGenerating = new Set<string>();

  const service = {
    // Clear in-memory state for a URL so the next request re-checks the DB.
    // Call when a file is updated or deleted.
    invalidateUrl(url: string): void {
      blurChecked.delete(url);
    },

    // Generate and persist a blur placeholder for `fileUrl` if one doesn't exist.
    // Safe to fire-and-forget — errors are logged internally. The in-memory sets
    // deduplicate concurrent calls and skip the DB lookup once a blur exists.
    async generateIfMissing(fileUrl: string): Promise<void> {
      if (blurChecked.has(fileUrl) || blurGenerating.has(fileUrl)) return;

      blurGenerating.add(fileUrl);
      try {
        const repo = getUploadFileRepository(strapi);
        const file = await repo.findOne({
          where: { url: fileUrl },
          select: ['id', 'mime', 'blurDataURL'],
        });

        if (!file) return;

        // Non-null means we already attempted generation (success or sentinel).
        if (file.blurDataURL !== null) {
          blurChecked.add(fileUrl);
          return;
        }

        const blurDataURL = await service.generate(fileUrl, file.mime);
        await repo.update({
          where: { id: file.id },
          data: { blurDataURL: blurDataURL ?? BLUR_SKIP_SENTINEL },
        });
        blurChecked.add(fileUrl);
      } catch (err) {
        strapi.log.error(`Failed to generate missing blur placeholder for ${fileUrl}:`, err);
      } finally {
        blurGenerating.delete(fileUrl);
      }
    },

    // Generate a tiny base64 blur placeholder. Returns a data URL, or null if
    // the file can't be processed.
    async generate(fileUrl: string, mime: string): Promise<string | null> {
      if (!SUPPORTED_MIME_TYPES.has(mime)) {
        return null;
      }

      const filePath = path.join(process.cwd(), 'public', fileUrl);

      let buffer: Buffer;
      try {
        buffer = await fsp.readFile(filePath);
      } catch {
        return null;
      }

      if (isAnimated(buffer, mime)) {
        return null;
      }

      const pluginConfig = strapi.config.get('plugin::next-image') as PluginConfig;
      const blurSize = pluginConfig.blurSize || 8;

      let sharp: Awaited<ReturnType<typeof loadSharp>>;
      try {
        sharp = await loadSharp();
      } catch {
        strapi.log.warn('sharp is required for blur placeholder generation');
        return null;
      }

      try {
        const tiny = await sharp(buffer)
          .resize(blurSize, undefined, { withoutEnlargement: true })
          .jpeg({ quality: 70 })
          .toBuffer();

        return `data:image/jpeg;base64,${tiny.toString('base64')}`;
      } catch (err) {
        strapi.log.error('Failed to generate blur placeholder:', err);
        return null;
      }
    },
  };

  return service;
};
