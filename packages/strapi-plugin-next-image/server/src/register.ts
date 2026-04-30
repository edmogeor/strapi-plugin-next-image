import type { Core } from '@strapi/types';
import { getContentTypesRegistry, type ContentTypeSchema } from './types';

export default ({ strapi }: { strapi: Core.Strapi }) => {
  // Add blurDataURL field to the upload file content type so it's
  // stored in the DB and included in API responses.
  const contentTypesRegistry = getContentTypesRegistry(strapi);
  contentTypesRegistry.extend('plugin::upload.file', (contentType: ContentTypeSchema) => {
    contentType.attributes.blurDataURL = {
      type: 'text',
      configurable: false,
    };
  });
};
