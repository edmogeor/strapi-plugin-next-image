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

async function fetchAndApplyConfig(apiBaseUrl: string): Promise<void> {
  try {
    const url = new URL('/api/next-image/config', apiBaseUrl);
    const res = await fetch(url.toString(), {
      // Respect Cache-Control from the server (max-age=300, stale-while-revalidate=86400).
      // Avoids unnecessary round-trips — the browser cache handles freshness.
      cache: 'default',
    });

    if (!res.ok) {
      console.warn(`[strapi-next-image] Failed to fetch config from ${url}: ${res.status}`);
      return;
    }

    const config = await res.json();

    imageConfigDefault = {
      ...imageConfigDefault,
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

/**
 * Fetch and apply image configuration from the Strapi backend.
 * Call this once at your application's entry point.
 *
 * On the server, the config fetch is awaited so SSR renders with the final config.
 * On the client, the fetch is deferred until after React hydration to prevent
 * hydration mismatches caused by changing deviceSizes mid-render.
 */
export async function initializeStrapiImage(apiBaseUrl: string): Promise<void> {
  // Set path immediately so images work even if the config fetch is not awaited
  imageConfigDefault = {
    ...imageConfigDefault,
    path: apiBaseUrl.replace(/\/$/, ''),
  };

  if (typeof window !== 'undefined') {
    // Client: defer config update until after React hydration completes
    setTimeout(() => { fetchAndApplyConfig(apiBaseUrl); }, 0);
  } else {
    // Server: await so SSR renders with the final config
    await fetchAndApplyConfig(apiBaseUrl);
  }
}


