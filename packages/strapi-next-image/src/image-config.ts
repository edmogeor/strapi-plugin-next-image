import type { ImageConfigComplete } from './types';

export let imageConfigDefault: ImageConfigComplete = {
  deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  imageSizes: [32, 48, 64, 96, 128, 256, 384],
  qualities: [75],
  formats: ['image/webp'],
  path: '',
  dangerouslyAllowSVG: false,
  unoptimized: false,
};

/**
 * Fetch and apply image configuration from the Strapi backend.
 * Call this once at your application's entry point.
 */
export async function initializeStrapiImage(apiBaseUrl: string): Promise<void> {
  try {
    const url = new URL('/api/next-image/config', apiBaseUrl);
    const res = await fetch(url.toString(), {
      // Configuration shouldn't change often, but we want it to be fresh on reload
      cache: 'no-cache',
    });

    if (!res.ok) {
      console.warn(`[strapi-next-image] Failed to fetch config from ${url}: ${res.status}`);
      return;
    }

    const config = await res.json();

    // Merge the remote config heavily into our local defaults
    imageConfigDefault = {
      ...imageConfigDefault,
      path: apiBaseUrl.replace(/\/$/, ''),
      ...(config.deviceSizes && { deviceSizes: config.deviceSizes }),
      ...(config.imageSizes && { imageSizes: config.imageSizes }),
      ...(config.qualities && { qualities: config.qualities }),
      ...(config.formats && { formats: config.formats }),
      ...(typeof config.dangerouslyAllowSVG === 'boolean' && { dangerouslyAllowSVG: config.dangerouslyAllowSVG }),
    };
  } catch (err) {
    console.error('[strapi-next-image] Error fetching config:', err);
  }
}


