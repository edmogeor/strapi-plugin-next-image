import type { ImageLoader, ImageLoaderProps, ImageLoaderWithConfig, ImageConfig } from './types';

const DEFAULT_QUALITY = 75;

function normalizeSrc(src: string, base: string): string {
  if (src.startsWith('http://') || src.startsWith('https://')) {
    try {
      const url = new URL(src);
      // Same-origin as the Strapi server → strip to the relative /uploads/ path.
      // Cross-origin (external storage provider) → forward the absolute URL so the
      // server can validate it against its remotePatterns allow-list.
      // No base configured → can't compare origins; preserve the historical
      // behavior of treating absolute URLs as same-origin Strapi uploads.
      if (!base || url.origin === new URL(base).origin) {
        return url.pathname + url.search;
      }
      return src;
    } catch {
      // fall through
    }
  }
  return src;
}

function buildOptimizeUrl(base: string, src: string, width: number, quality?: number): string {
  const q = quality || DEFAULT_QUALITY;
  return `${base}/api/next-image?url=${encodeURIComponent(normalizeSrc(src, base))}&w=${width}&q=${q}`;
}

/**
 * Default Strapi image loader.
 * Generates URLs pointing at the strapi-plugin-image optimization endpoint.
 */
const strapiLoader: ImageLoaderWithConfig & { __strapi_img_default: true } = Object.assign(
  ({ src, width, quality, config }: ImageLoaderProps & { config: Readonly<ImageConfig> }): string =>
    buildOptimizeUrl(config?.path || '', src, width, quality),
  { __strapi_img_default: true as const },
);

export default strapiLoader as ImageLoaderWithConfig;

/**
 * Create a loader with a custom Strapi base URL.
 */
export function createStrapiLoader(strapiUrl: string): ImageLoader {
  const base = strapiUrl.replace(/\/$/, '');
  const loader: ImageLoader & { __strapi_img_default: true } = Object.assign(
    ({ src, width, quality }: ImageLoaderProps): string =>
      buildOptimizeUrl(base, src, width, quality),
    { __strapi_img_default: true as const },
  );
  return loader;
}
