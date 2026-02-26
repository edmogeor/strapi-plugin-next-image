import type { Core } from '@strapi/types';

export default ({ strapi }: { strapi: Core.Strapi }) => {
  // Add blurDataURL field to the upload file content type so it's
  // included in API responses automatically.
  strapi.contentTypes.extend('plugin::upload.file', (schema) => ({
    ...schema,
    attributes: {
      ...schema.attributes,
      blurDataURL: { type: 'text', configurable: false },
    },
  }));
};
