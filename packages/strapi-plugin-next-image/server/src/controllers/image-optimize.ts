import type { Core } from '@strapi/types';
import type { Context } from 'koa';

function getService(strapi: Core.Strapi, name: string) {
  return strapi.plugin('image-optimize').service(name);
}

/**
 * Determine the best output format based on Accept header and plugin config.
 * Mirrors Next.js getSupportedMimeType().
 */
function getSupportedMimeType(accept: string, configFormats: string[]): string | null {
  const acceptHeader = accept || '';
  // Prefer avif > webp if both configured and accepted
  const mimeTypes = ['image/avif', 'image/webp'];
  for (const mime of mimeTypes) {
    if (configFormats.includes(mime) && acceptHeader.includes(mime)) {
      return mime;
    }
  }
  return null;
}

const controller: Core.Controller = {
  async optimize(ctx: Context) {
    const { url, w, q, f } = ctx.query as Record<string, string | undefined>;

    // --- Validate url ---
    if (!url || typeof url !== 'string') {
      ctx.status = 400;
      ctx.body = { error: '"url" query parameter is required' };
      return;
    }

    // Only allow local upload URLs
    if (!url.startsWith('/uploads/')) {
      ctx.status = 400;
      ctx.body = { error: '"url" must start with /uploads/' };
      return;
    }

    // --- Load plugin config ---
    const pluginConfig = strapi.config.get('plugin::image-optimize') as {
      deviceSizes: number[];
      imageSizes: number[];
      qualities: number[];
      formats: string[];
      minimumCacheTTL: number;
      dangerouslyAllowSVG: boolean;
    };

    const allSizes = [...pluginConfig.deviceSizes, ...pluginConfig.imageSizes].sort(
      (a, b) => a - b
    );

    // --- Validate width ---
    const width = parseInt(w || '', 10);
    if (!w || isNaN(width) || !allSizes.includes(width)) {
      ctx.status = 400;
      ctx.body = {
        error: `"w" must be one of: ${allSizes.join(', ')}`,
      };
      return;
    }

    // --- Validate quality ---
    const quality = parseInt(q || '75', 10);
    if (isNaN(quality) || quality < 1 || quality > 100) {
      ctx.status = 400;
      ctx.body = { error: '"q" must be between 1 and 100' };
      return;
    }

    // --- Determine output format ---
    let outputFormat: string | null = null;
    if (f) {
      const fmtMap: Record<string, string> = {
        webp: 'image/webp',
        avif: 'image/avif',
      };
      outputFormat = fmtMap[f] || null;
    }
    if (!outputFormat) {
      outputFormat = getSupportedMimeType(
        ctx.get('accept') || '',
        pluginConfig.formats
      );
    }

    // --- Call the optimization service ---
    try {
      const optimizeService = getService(strapi, 'image-optimize');
      const result = await optimizeService.optimize({
        url,
        width,
        quality,
        outputFormat,
        minimumCacheTTL: pluginConfig.minimumCacheTTL,
        dangerouslyAllowSVG: pluginConfig.dangerouslyAllowSVG,
      });

      // Set response headers
      ctx.set('Content-Type', result.contentType);
      ctx.set(
        'Cache-Control',
        `public, max-age=${pluginConfig.minimumCacheTTL}, immutable`
      );
      if (result.etag) {
        ctx.set('ETag', result.etag);
      }
      ctx.set(
        'Content-Disposition',
        `inline; filename="${result.filename}"`
      );

      // Check ETag for 304
      const ifNoneMatch = ctx.get('if-none-match');
      if (ifNoneMatch && result.etag && ifNoneMatch === result.etag) {
        ctx.status = 304;
        return;
      }

      ctx.body = result.buffer;
    } catch (err: any) {
      if (err.status) {
        ctx.status = err.status;
        ctx.body = { error: err.message };
      } else {
        strapi.log.error('Image optimization error:', err);
        ctx.status = 500;
        ctx.body = { error: 'Internal server error during image optimization' };
      }
    }
  },
};

export default controller;
