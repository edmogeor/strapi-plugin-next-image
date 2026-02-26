import type { Core } from '@strapi/types';

function getService(strapi: Core.Strapi, name: string) {
  return strapi.plugin('image-optimize').service(name);
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
    name: 'image-optimize',
  });

  const existingConfig = await pluginStore.get({ key: 'settings' });

  if (!existingConfig) {
    const defaultConfig = strapi.config.get('plugin::image-optimize') as Record<string, unknown>;
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
      event.state.oldUrl = event.params?.data?.url;
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
      // Regenerate if the file URL changed (file was replaced)
      if (event.state.oldUrl && event.state.oldUrl !== result.url) {
        generateAndSaveBlur(strapi, result.id, result.url, result.mime);
      }
    },
  });
};
