import type { ImageConfigComplete } from './types';

/**
 * Client-side defaults mirror the server canonical config in
 * packages/strapi-plugin-next-image/server/src/config.ts.
 * These are fallback values used only before the first successful fetch
 * from /api/next-image/config. The server config is the SSOT.
 */
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
      ...(typeof config.dangerouslyAllowSVG === 'boolean' && {
        dangerouslyAllowSVG: config.dangerouslyAllowSVG,
      }),
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
 * On the client, the server-fetched config is read synchronously from a global that the
 * Image component embeds in the SSR HTML, ensuring hydration uses the same sizes as the
 * server without a CORS round-trip. A deferred fetch is still scheduled to pick up any
 * changes since the last SSR.
 */
export async function initializeStrapiImage(apiBaseUrl: string): Promise<void> {
  // Set path immediately so images work even if the config fetch is not awaited
  imageConfigDefault = {
    ...imageConfigDefault,
    path: apiBaseUrl.replace(/\/$/, ''),
  };

  if (typeof window !== 'undefined') {
    // Client: apply config embedded by the server in the SSR HTML (avoids CORS).
    // The Image component renders an inline <script> that sets this global during SSR.
    const embedded = window.__STRAPI_IMAGE_CONFIG__;
    if (embedded) {
      imageConfigDefault = {
        ...imageConfigDefault,
        ...(Array.isArray(embedded.deviceSizes) && { deviceSizes: embedded.deviceSizes }),
        ...(Array.isArray(embedded.imageSizes) && { imageSizes: embedded.imageSizes }),
        ...(Array.isArray(embedded.qualities) && { qualities: embedded.qualities }),
        ...(Array.isArray(embedded.formats) && { formats: embedded.formats }),
        ...(typeof embedded.dangerouslyAllowSVG === 'boolean' && {
          dangerouslyAllowSVG: embedded.dangerouslyAllowSVG,
        }),
      };
    }
    // Still defer a fresh fetch in case the server config has changed since the last SSR.
    setTimeout(() => {
      fetchAndApplyConfig(apiBaseUrl);
    }, 0);
  } else {
    // Server: await so SSR renders with the final config
    await fetchAndApplyConfig(apiBaseUrl);
  }
}
