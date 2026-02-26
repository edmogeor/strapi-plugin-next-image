import type { Core } from '@strapi/types';

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
};
