import type { Core } from '@strapi/types';
import type { InvalidateConfig } from './services/cache';

function getService(strapi: Core.Strapi, name: string) {
  return strapi.plugin('next-image').service(name);
}

function invalidateCacheForUrl(strapi: Core.Strapi, url: string) {
  try {
    const config = strapi.config.get('plugin::next-image') as InvalidateConfig;
    const cacheService = getService(strapi, 'cache');
    cacheService.invalidateUrl(url, config);
    // Also clear the blur service's in-memory confirmation so the next
    // request re-checks the DB after the file has been replaced/deleted.
    const blurService = getService(strapi, 'blur-placeholder');
    blurService.invalidateUrl(url);
  } catch (err) {
    strapi.log.error(`Failed to invalidate cache for ${url}:`, err);
  }
}

async function generateAndSaveBlur(strapi: Core.Strapi, fileId: number, fileUrl: string, mime: string) {
  try {
    const blurService = getService(strapi, 'blur-placeholder');
    const blurDataURL = await blurService.generate(fileUrl, mime);
    if (blurDataURL) {
      await strapi.db.query('plugin::upload.file').update({
        where: { id: fileId },
        data: { blurDataURL },
      });
    }
  } catch (err) {
    strapi.log.error(`Failed to generate blur placeholder for file ${fileId}:`, err);
  }
}

async function backfillMissingBlurs(strapi: Core.Strapi): Promise<void> {
  const files = await (strapi.db.query('plugin::upload.file') as any).findMany({
    where: { blurDataURL: { $null: true }, mime: { $startsWith: 'image/' } },
    select: ['id', 'url', 'mime'],
  });

  if (files.length === 0) return;

  strapi.log.info(`[next-image] Generating blur placeholders for ${files.length} image(s)...`);
  for (const file of files) {
    await generateAndSaveBlur(strapi, file.id, file.url, file.mime);
  }
  strapi.log.info('[next-image] Blur placeholder backfill complete.');
}

export default async ({ strapi }: { strapi: Core.Strapi }) => {
  // Initialize default plugin settings in the store if not already set
  const pluginStore = strapi.store({
    type: 'plugin',
    name: 'next-image',
  });

  const existingConfig = await pluginStore.get({ key: 'settings' });

  if (!existingConfig) {
    const defaultConfig = strapi.config.get('plugin::next-image') as Record<string, unknown>;
    await pluginStore.set({
      key: 'settings',
      value: defaultConfig,
    });
  }

  // If blurSize changed, clear all stored blur placeholders so they get regenerated.
  const pluginConfig = strapi.config.get('plugin::next-image') as { blurSize?: number };
  const currentBlurSize = pluginConfig.blurSize ?? 8;
  const storedBlurSize = (await pluginStore.get({ key: 'blurSize' })) as number | null;

  if (storedBlurSize !== null && storedBlurSize !== currentBlurSize) {
    strapi.log.info(
      `[next-image] blurSize changed (${storedBlurSize} → ${currentBlurSize}), clearing all blur placeholders for regeneration`
    );
    await (strapi.db.query('plugin::upload.file') as any).updateMany({
      where: { blurDataURL: { $null: false } },
      data: { blurDataURL: null },
    });
  }

  await pluginStore.set({ key: 'blurSize', value: currentBlurSize });

  // Generate blur placeholders for any images that don't have one yet.
  // Runs synchronously so all blurs are ready before Strapi starts serving.
  await backfillMissingBlurs(strapi);

  // Auto-generate blur placeholders when images are uploaded or replaced
  strapi.db.lifecycles.subscribe({
    models: ['plugin::upload.file'],

    async beforeUpdate(event) {
      // Fetch the current URL from DB so afterUpdate can detect file replacement.
      // (event.params.data.url is the *new* value being written, not the old one.)
      const where = event.params?.where;
      if (where) {
        const current = await (strapi.db.query('plugin::upload.file') as any).findOne({
          where,
          select: ['url'],
        });
        (event.state as Record<string, unknown>).oldUrl = current?.url;
      }
    },

    afterCreate(event) {
      const { result } = event;
      if (result?.id && result?.url && result?.mime?.startsWith('image/')) {
        // Fire-and-forget — don't block the upload response
        generateAndSaveBlur(strapi, result.id, result.url, result.mime);
      }
    },

    afterUpdate(event) {
      const { result } = event;
      if (!result?.id || !result?.url || !result?.mime?.startsWith('image/')) {
        return;
      }

      // Always invalidate cache — file content may have changed even if URL didn't
      // (e.g. Strapi's "replace file" feature keeps the same URL)
      invalidateCacheForUrl(strapi, result.url);

      // If URL changed (file replaced with a new upload), also purge old URL's
      // cache variants and regenerate the blur for the new file.
      const oldUrl = (event.state as Record<string, unknown>).oldUrl as string | undefined;
      if (oldUrl && oldUrl !== result.url) {
        invalidateCacheForUrl(strapi, oldUrl);
        generateAndSaveBlur(strapi, result.id, result.url, result.mime);
      }
    },

    afterDelete(event) {
      const { result } = event;
      if (result?.url && result?.mime?.startsWith('image/')) {
        invalidateCacheForUrl(strapi, result.url);
      }
    },
  });
};
