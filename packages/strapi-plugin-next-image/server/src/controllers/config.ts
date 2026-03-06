import * as crypto from 'crypto';

export default {
  get(ctx: any) {
    const pluginConfig = strapi.config.get('plugin::next-image') as {
      deviceSizes: number[];
      imageSizes: number[];
      qualities: number[];
      formats: string[];
      dangerouslyAllowSVG: boolean;
    };

    // Return only the public frontend-relevant settings.
    // We intentionally exclude sensitive settings like minimumCacheTTL
    // which dictates backend infrastructure behavior.
    const body = {
      deviceSizes: pluginConfig.deviceSizes,
      imageSizes: pluginConfig.imageSizes,
      qualities: pluginConfig.qualities,
      formats: pluginConfig.formats,
      dangerouslyAllowSVG: pluginConfig.dangerouslyAllowSVG,
    };

    const etag = crypto
      .createHash('sha256')
      .update(JSON.stringify(body))
      .digest('hex')
      .slice(0, 16);

    ctx.set('Access-Control-Allow-Origin', '*');
    ctx.set('ETag', etag);
    ctx.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=86400');

    if (ctx.get('if-none-match') === etag) {
      ctx.status = 304;
      return;
    }

    ctx.body = body;
  },
};
