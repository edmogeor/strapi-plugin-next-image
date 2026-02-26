import type { ImageLoaderProps, ImageLoaderWithConfig } from './types';

const DEFAULT_QUALITY = 75;

function buildOptimizeUrl(base: string, src: string, width: number, quality?: number): string {
  const q = quality || DEFAULT_QUALITY;
  return `${base}/api/image-optimize?url=${encodeURIComponent(src)}&w=${width}&q=${q}`;
}

/**
 * Default Strapi image loader.
 * Generates URLs pointing at the strapi-plugin-image optimization endpoint.
 */
const strapiLoader: ImageLoaderWithConfig & { __strapi_img_default: true } =
  Object.assign(
    ({ src, width, quality }: ImageLoaderProps & { config: unknown }): string =>
      buildOptimizeUrl('', src, width, quality),
    { __strapi_img_default: true as const }
  );

export default strapiLoader as ImageLoaderWithConfig;

/**
 * Create a loader with a custom Strapi base URL.
 */
export function createStrapiLoader(strapiUrl: string): ImageLoaderWithConfig {
  const base = strapiUrl.replace(/\/$/, '');
  const loader: ImageLoaderWithConfig & { __strapi_img_default: true } =
    Object.assign(
      ({ src, width, quality }: ImageLoaderProps & { config: unknown }): string =>
        buildOptimizeUrl(base, src, width, quality),
      { __strapi_img_default: true as const }
    );
  return loader;
}
