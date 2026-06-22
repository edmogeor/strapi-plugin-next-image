import type { Core } from '@strapi/types';

/**
 * Allow-list entry for optimizing images hosted on external origins
 * (e.g. S3, Google Cloud Storage). Mirrors `next/image` remotePatterns.
 * @see https://nextjs.org/docs/app/api-reference/components/image#remotepatterns
 */
export interface RemotePattern {
  /** Must be `http` or `https`. Omit to match either. */
  protocol?: 'http' | 'https';
  /** Hostname glob. `*` matches a single subdomain, `**` matches any number. */
  hostname: string;
  /** Literal port such as `8080`, or empty string for no port. */
  port?: string;
  /** Pathname glob. `*` matches a single segment, `**` matches any number. Defaults to `**`. */
  pathname?: string;
  /** Literal query string such as `?v=1`, or empty string for none. */
  search?: string;
}

/** Full plugin configuration shape. */
export interface PluginConfig {
  deviceSizes: number[];
  imageSizes: number[];
  qualities: number[];
  formats: string[];
  minimumCacheTTL: number;
  dangerouslyAllowSVG: boolean;
  blurSize: number;
  /** Allow-listed external origins. Empty = only local `/uploads/` allowed (default). */
  remotePatterns: RemotePattern[];
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
// fallow-ignore-next-line unused-type
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
import type imageOptimizeServiceFactory from './services/image-optimize';

/** Return type of the cache service factory. */
// fallow-ignore-next-line unused-type
export type CacheService = ReturnType<typeof cacheServiceFactory>;

/** Return type of the blur-placeholder service factory. */
// fallow-ignore-next-line unused-type
export type BlurPlaceholderService = ReturnType<typeof blurPlaceholderServiceFactory>;

/** Return type of the image-optimize service factory. */
// fallow-ignore-next-line unused-type
export type ImageOptimizeService = ReturnType<typeof imageOptimizeServiceFactory>;

/**
 * Typed accessors for Strapi plugin services.
 * Centralising the `as unknown as` cast here so consumers get typed services
 * without repeating the cast pattern across the codebase.
 */
export function getCacheService(strapi: Core.Strapi): CacheService {
  return strapi.plugin('next-image').service('cache') as unknown as CacheService;
}

export function getBlurService(strapi: Core.Strapi): BlurPlaceholderService {
  return strapi
    .plugin('next-image')
    .service('blur-placeholder') as unknown as BlurPlaceholderService;
}

export function getOptimizeService(strapi: Core.Strapi): ImageOptimizeService {
  return strapi.plugin('next-image').service('next-image') as unknown as ImageOptimizeService;
}

/** Returns a properly-typed query repository for plugin::upload.file. */
export function getUploadFileRepository(strapi: Core.Strapi): UploadFileRepository {
  return strapi.db.query('plugin::upload.file') as unknown as UploadFileRepository;
}

/** Returns the Strapi content-types registry with typed get() method. */
export function getContentTypesRegistry(strapi: Core.Strapi): ContentTypesRegistry {
  return (strapi as Core.Strapi & { get(key: string): unknown }).get(
    'content-types',
  ) as unknown as ContentTypesRegistry;
}
