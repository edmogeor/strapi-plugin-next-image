export default {
  default: {
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [32, 48, 64, 96, 128, 256, 384],
    qualities: [75],
    formats: ['image/webp'] as string[],
    minimumCacheTTL: 14400, // 4 hours in seconds
    dangerouslyAllowSVG: false,
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
  },
};
