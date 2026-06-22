import type { Core } from '@strapi/types';
import type { Context } from 'koa';
import type { PluginConfig, HttpError } from '../types';
import { getCacheService, getOptimizeService } from '../types';
import { hasRemoteMatch } from '../remote-pattern';

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

function buildCacheControl(isDev: boolean, ttl: number): string {
  if (isDev) return 'public, max-age=0, must-revalidate';
  return `public, max-age=${ttl}, stale-while-revalidate=${ttl}`;
}

// The response format depends on the Accept header, so caches must vary on it.
const VARY = 'Accept';

const controller: Core.Controller = {
  async optimize(ctx: Context) {
    const { url, w, q, f } = ctx.query as Record<string, string | undefined>;

    // --- Validate url ---
    if (!url || typeof url !== 'string') {
      ctx.status = 400;
      ctx.body = { error: '"url" query parameter is required' };
      return;
    }

    // --- Load plugin config ---
    const pluginConfig = strapi.config.get('plugin::next-image') as PluginConfig;

    // --- Validate url against allow-list (mirrors next/image image-optimizer) ---
    // Protocol-relative URLs (//host/...) are ambiguous and never allowed.
    if (url.startsWith('//')) {
      ctx.status = 400;
      ctx.body = { error: '"url" parameter cannot be a protocol-relative URL (//)' };
      return;
    }

    let isRemote: boolean;
    if (url.startsWith('/')) {
      // Local path: restricted to Strapi's uploads directory.
      // ponytail: keep the /uploads/ guard instead of next.js localPatterns;
      // all local Strapi assets live under /uploads/. Add localPatterns if that changes.
      if (!url.startsWith('/uploads/')) {
        ctx.status = 400;
        ctx.body = { error: '"url" must start with /uploads/' };
        return;
      }
      isRemote = false;
    } else {
      // Absolute URL: only allowed if it matches a configured remotePattern.
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        ctx.status = 400;
        ctx.body = { error: '"url" parameter is invalid' };
        return;
      }
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        ctx.status = 400;
        ctx.body = { error: '"url" parameter is invalid' };
        return;
      }
      if (!hasRemoteMatch(pluginConfig.remotePatterns ?? [], parsed)) {
        ctx.status = 400;
        ctx.body = { error: '"url" parameter is not allowed' };
        return;
      }
      isRemote = true;
    }

    const allSizes = [...pluginConfig.deviceSizes, ...pluginConfig.imageSizes].sort(
      (a, b) => a - b,
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
      outputFormat = getSupportedMimeType(ctx.get('accept') || '', pluginConfig.formats);
    }

    const isDev = process.env.NODE_ENV !== 'production';
    const ttl = pluginConfig.minimumCacheTTL;

    // --- Fast-path: 304 via ETag without reading the image buffer ---
    const ifNoneMatch = ctx.get('if-none-match');
    if (ifNoneMatch) {
      const cacheService = getCacheService(strapi);
      const formatKey = outputFormat || 'original';
      const peek = await cacheService.peekEtag(url, width, quality, formatKey);
      if (peek && peek.etag === ifNoneMatch) {
        ctx.set('ETag', peek.etag);
        ctx.set('Cache-Control', buildCacheControl(isDev, ttl));
        ctx.set('Vary', VARY);
        ctx.status = 304;
        return;
      }
    }

    // --- Call the optimization service ---
    try {
      const optimizeService = getOptimizeService(strapi);
      const result = await optimizeService.optimize({
        url,
        isRemote,
        width,
        quality,
        outputFormat,
        minimumCacheTTL: ttl,
        dangerouslyAllowSVG: pluginConfig.dangerouslyAllowSVG,
      });

      // Set response headers
      ctx.set('Content-Type', result.contentType);
      ctx.set('Cache-Control', buildCacheControl(isDev, ttl));
      ctx.set('Vary', VARY);

      if (result.etag) {
        ctx.set('ETag', result.etag);
      }
      ctx.set('Content-Disposition', `inline; filename="${result.filename}"`);

      // Final ETag check (handles the case where optimize() produced the same
      // content as what the client already has, e.g. after a stale revalidation)
      if (ifNoneMatch && result.etag && ifNoneMatch === result.etag) {
        ctx.status = 304;
        return;
      }

      ctx.set('Content-Length', String(result.buffer.length));
      ctx.body = result.buffer;
    } catch (err: unknown) {
      const httpErr = err as Partial<HttpError>;
      if (typeof httpErr.status === 'number') {
        ctx.status = httpErr.status;
        ctx.body = { error: httpErr.message };
      } else {
        strapi.log.error('Image optimization error:', err);
        ctx.status = 500;
        ctx.body = { error: 'Internal server error during image optimization' };
      }
    }
  },
};

export default controller;
