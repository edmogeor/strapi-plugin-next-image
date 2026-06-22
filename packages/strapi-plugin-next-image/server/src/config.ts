/**
 * Canonical default configuration.
 * This is the SSOT (Single Source of Truth) for image config defaults.
 * The client package mirrors these values as fallback defaults —
 * keep them in sync. See packages/strapi-next-image/src/image-config.ts.
 */
export default {
  default: {
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [32, 48, 64, 96, 128, 256, 384],
    qualities: [75],
    formats: ['image/webp'],
    minimumCacheTTL: 14400, // 4 hours in seconds
    dangerouslyAllowSVG: false,
    blurSize: 8, // width in pixels for blur placeholder thumbnails
    remotePatterns: [], // default: no external origins allowed (matches next/image)
  },
  validator(config: Record<string, unknown>) {
    if (config.deviceSizes && !Array.isArray(config.deviceSizes)) {
      throw new Error('deviceSizes must be an array of numbers');
    }
    if (config.imageSizes && !Array.isArray(config.imageSizes)) {
      throw new Error('imageSizes must be an array of numbers');
    }
    if (config.qualities && !Array.isArray(config.qualities)) {
      throw new Error('qualities must be an array of numbers');
    }
    if (config.minimumCacheTTL && typeof config.minimumCacheTTL !== 'number') {
      throw new Error('minimumCacheTTL must be a number');
    }
    if (config.blurSize && typeof config.blurSize !== 'number') {
      throw new Error('blurSize must be a number');
    }
    if (config.remotePatterns) {
      if (!Array.isArray(config.remotePatterns)) {
        throw new Error('remotePatterns must be an array');
      }
      for (const p of config.remotePatterns) {
        if (!p || typeof (p as { hostname?: unknown }).hostname !== 'string') {
          throw new Error('each remotePattern must define a string "hostname"');
        }
      }
    }
  },
};
