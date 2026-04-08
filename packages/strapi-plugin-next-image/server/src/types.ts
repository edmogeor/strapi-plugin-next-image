import type { Core } from '@strapi/types';

/** Full plugin configuration shape. */
export interface PluginConfig {
  deviceSizes: number[];
  imageSizes: number[];
  qualities: number[];
  formats: string[];
  minimumCacheTTL: number;
  dangerouslyAllowSVG: boolean;
  blurSize: number;
}

/** Upload file entity stored in the database. */
interface UploadFile {
  id: number;
  url: string;
  mime: string;
  blurDataURL: string | null;
}

/** Typed query repository for plugin::upload.file. */
interface UploadFileRepository {
  findMany(params: { where: Record<string, unknown>; select?: string[] }): Promise<UploadFile[]>;
  findOne(params: {
    where: Record<string, unknown>;
    select?: string[];
  }): Promise<UploadFile | null>;
  update(params: {
    where: Record<string, unknown>;
    data: Partial<UploadFile>;
  }): Promise<UploadFile>;
  updateMany(params: {
    where: Record<string, unknown>;
    data: Partial<UploadFile>;
  }): Promise<{ count: number }>;
}

/** Strapi attribute definition inside a content type schema. */
interface ContentTypeAttribute {
  type: string;
  configurable?: boolean;
  [key: string]: unknown;
}

/** Strapi content type schema object passed to registry.extend(). */
export interface ContentTypeSchema {
  attributes: Record<string, ContentTypeAttribute>;
}

/** Strapi internal content types registry (accessed via strapi.get('content-types')). */
export interface ContentTypesRegistry {
  extend(uid: string, callback: (contentType: ContentTypeSchema) => void): void;
}

/** Error enriched with an HTTP status code thrown by optimization services. */
export interface HttpError extends Error {
  status: number;
}

// --- Derived service types ---
// These use `typeof import(...)` so consumers get full type safety without
// coupling to the concrete service implementations at runtime.

import type cacheServiceFactory from './services/cache';
import type blurPlaceholderServiceFactory from './services/blur-placeholder';

/** Return type of the cache service factory. */
export type CacheService = ReturnType<typeof cacheServiceFactory>;

/** Return type of the blur-placeholder service factory. */
export type BlurPlaceholderService = ReturnType<typeof blurPlaceholderServiceFactory>;

/** Returns a properly-typed query repository for plugin::upload.file. */
export function getUploadFileRepository(strapi: Core.Strapi): UploadFileRepository {
  return strapi.db.query('plugin::upload.file') as unknown as UploadFileRepository;
}
