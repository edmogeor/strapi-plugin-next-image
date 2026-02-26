import type { Core } from '@strapi/types';

export default ({ strapi }: { strapi: Core.Strapi }) => {
  // Add blurDataURL field to the upload file content type so it's
  // included in API responses automatically.
  const contentTypesRegistry = (strapi as any).get('content-types');
  contentTypesRegistry.extend('plugin::upload.file', (schema: any) => ({
    ...schema,
    attributes: {
      ...schema.attributes,
      blurDataURL: { type: 'text', configurable: false },
    },
  }));
};
