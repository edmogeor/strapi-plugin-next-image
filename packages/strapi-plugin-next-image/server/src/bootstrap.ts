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

  // Auto-generate blur placeholders when images are uploaded or replaced
  strapi.db.lifecycles.subscribe({
    models: ['plugin::upload.file'],

    beforeUpdate(event) {
      // Stash the current URL so afterUpdate can detect file replacement
      (event.state as Record<string, unknown>).oldUrl = event.params?.data?.url;
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

      // If URL changed, also purge old URL's variants and regenerate blur
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
