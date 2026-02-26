import type { ImageConfigComplete } from './types';

export const imageConfigDefault: ImageConfigComplete = {
  deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  imageSizes: [32, 48, 64, 96, 128, 256, 384],
  qualities: [75],
  formats: ['image/webp'],
  dangerouslyAllowSVG: false,
  unoptimized: false,
};

let imageConfig: ImageConfigComplete = { ...imageConfigDefault };

/**
 * Override the default image configuration.
 * Call once at your app's entry point (e.g. `_app.tsx` or `layout.tsx`).
 *
 * @example
 * ```ts
 * import { configure } from 'strapi-next-image';
 * configure({ deviceSizes: [640, 1080, 1920], qualities: [80] });
 * ```
 */
export function configure(overrides: Partial<ImageConfigComplete>): void {
  imageConfig = { ...imageConfigDefault, ...overrides };
}

/** Return the current (possibly user-configured) image config. */
export function getImageConfig(): ImageConfigComplete {
  return imageConfig;
}
