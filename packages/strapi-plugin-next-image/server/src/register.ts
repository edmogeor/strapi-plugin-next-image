import type { Core } from '@strapi/types';

export default ({ strapi }: { strapi: Core.Strapi }) => {
  // Add blurDataURL field to the upload file content type so it's
  // stored in the DB and included in API responses.
  const contentTypesRegistry = (strapi as any).get('content-types');
  contentTypesRegistry.extend('plugin::upload.file', (contentType: any) => {
    contentType.attributes.blurDataURL = {
      type: 'text',
      configurable: false,
    };
  });
};
