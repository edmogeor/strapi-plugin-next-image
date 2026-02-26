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
        ctx.body = {
            deviceSizes: pluginConfig.deviceSizes,
            imageSizes: pluginConfig.imageSizes,
            qualities: pluginConfig.qualities,
            formats: pluginConfig.formats,
            dangerouslyAllowSVG: pluginConfig.dangerouslyAllowSVG,
        };
    },
};
