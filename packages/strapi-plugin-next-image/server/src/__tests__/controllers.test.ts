import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Context } from 'koa';
import type { PluginConfig } from '../types';

// Import controllers at module level (they only use the `strapi` global at call time)
import configController from '../controllers/config';
import imageOptimizeController from '../controllers/image-optimize';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultConfig: PluginConfig = {
  deviceSizes: [640, 1080, 1920],
  imageSizes: [64, 128, 256],
  qualities: [75],
  formats: ['image/webp'],
  minimumCacheTTL: 3600,
  dangerouslyAllowSVG: false,
  blurSize: 8,
  remotePatterns: [],
};

function makeMockCtx(
  query: Record<string, string> = {},
  requestHeaders: Record<string, string> = {},
): Context {
  const responseHeaders: Record<string, string> = {};
  const lc = Object.fromEntries(
    Object.entries(requestHeaders).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return {
    query,
    status: 200,
    body: undefined,
    get: vi.fn((h: string) => lc[h.toLowerCase()] ?? ''),
    set: vi.fn((h: string, v: string) => {
      responseHeaders[h.toLowerCase()] = v;
    }),
    _headers: responseHeaders,
  } as unknown as Context;
}

function stubStrapi(configOverrides: Partial<PluginConfig> = {}) {
  const cacheService = {
    peekEtag: vi.fn().mockResolvedValue(null),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue({ etag: 'testEtag' }),
  };
  const optimizeService = {
    optimize: vi.fn().mockResolvedValue({
      buffer: Buffer.from('image-bytes'),
      contentType: 'image/webp',
      etag: 'testEtag',
      filename: 'photo.webp',
    }),
  };

  vi.stubGlobal('strapi', {
    config: {
      get: vi.fn().mockReturnValue({ ...defaultConfig, ...configOverrides }),
    },
    log: { error: vi.fn() },
    plugin: vi.fn().mockReturnValue({
      service: vi.fn((name: string) => {
        if (name === 'cache') return cacheService;
        if (name === 'next-image') return optimizeService;
        return {};
      }),
    }),
  });

  return { cacheService, optimizeService };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Config controller
// ---------------------------------------------------------------------------

describe('configController.get', () => {
  it('returns public config fields', () => {
    stubStrapi();
    const ctx = makeMockCtx();
    configController.get(ctx, async () => {});
    expect(ctx.body).toMatchObject({
      deviceSizes: defaultConfig.deviceSizes,
      imageSizes: defaultConfig.imageSizes,
      qualities: defaultConfig.qualities,
      formats: defaultConfig.formats,
      dangerouslyAllowSVG: false,
    });
  });

  it('does not expose minimumCacheTTL or blurSize', () => {
    stubStrapi();
    const ctx = makeMockCtx();
    configController.get(ctx, async () => {});
    expect(ctx.body).not.toHaveProperty('minimumCacheTTL');
    expect(ctx.body).not.toHaveProperty('blurSize');
  });

  it('sets ETag, Cache-Control, and Access-Control-Allow-Origin headers', () => {
    stubStrapi();
    const ctx = makeMockCtx();
    configController.get(ctx, async () => {});
    expect(ctx.set).toHaveBeenCalledWith('ETag', expect.any(String));
    expect(ctx.set).toHaveBeenCalledWith('Cache-Control', expect.stringContaining('max-age='));
    expect(ctx.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
  });

  it('returns 304 when If-None-Match matches the computed ETag', () => {
    stubStrapi();

    // First request: capture the ETag
    const ctx1 = makeMockCtx();
    configController.get(ctx1, async () => {});
    const etag = (ctx1.set as ReturnType<typeof vi.fn>).mock.calls.find(
      (args: unknown[]) => args[0] === 'ETag',
    )?.[1] as string;

    // Second request with matching If-None-Match
    const ctx2 = makeMockCtx({}, { 'if-none-match': etag });
    configController.get(ctx2, async () => {});

    expect(ctx2.status).toBe(304);
    expect(ctx2.body).toBeUndefined();
  });

  it('returns 200 and body when If-None-Match does not match', () => {
    stubStrapi();
    const ctx = makeMockCtx({}, { 'if-none-match': 'stale-etag' });
    configController.get(ctx, async () => {});
    expect(ctx.status).toBe(200);
    expect(ctx.body).toBeDefined();
  });

  it('generates a deterministic ETag from the config content', () => {
    stubStrapi();
    const ctx1 = makeMockCtx();
    const ctx2 = makeMockCtx();
    configController.get(ctx1, async () => {});
    configController.get(ctx2, async () => {});

    const etag1 = (ctx1.set as ReturnType<typeof vi.fn>).mock.calls.find(
      (args: unknown[]) => args[0] === 'ETag',
    )?.[1];
    const etag2 = (ctx2.set as ReturnType<typeof vi.fn>).mock.calls.find(
      (args: unknown[]) => args[0] === 'ETag',
    )?.[1];

    expect(etag1).toBe(etag2);
  });
});

// ---------------------------------------------------------------------------
// Image optimize controller
// ---------------------------------------------------------------------------

async function assertValidationError(
  query: Record<string, string>,
  expectedErrorPattern: RegExp | string,
): Promise<void> {
  const ctx = makeMockCtx(query);
  await imageOptimizeController.optimize(ctx, async () => {});
  expect(ctx.status).toBe(400);
  expect((ctx.body as Record<string, string>).error).toMatch(expectedErrorPattern);
}

describe('imageOptimizeController.optimize', () => {
  it('returns 400 when url param is missing', async () => {
    stubStrapi();
    await assertValidationError({ w: '640', q: '75' }, /url/i);
  });

  it('returns 400 when url does not start with /uploads/', async () => {
    stubStrapi();
    await assertValidationError({ url: '/etc/passwd', w: '640', q: '75' }, /\/uploads\//);
  });

  it('returns 400 for a protocol-relative url', async () => {
    stubStrapi();
    await assertValidationError(
      { url: '//evil.com/img.jpg', w: '640', q: '75' },
      /protocol-relative/,
    );
  });

  it('returns 400 for an absolute url with no matching remotePattern', async () => {
    stubStrapi(); // default remotePatterns: []
    await assertValidationError(
      { url: 'https://storage.googleapis.com/bucket/img.jpg', w: '640', q: '75' },
      /not allowed/,
    );
  });

  it('returns 400 for a non-http(s) absolute url even if hostname matches', async () => {
    stubStrapi({ remotePatterns: [{ hostname: 'evil.com' }] });
    await assertValidationError({ url: 'ftp://evil.com/img.jpg', w: '640', q: '75' }, /invalid/);
  });

  it('allows an absolute url that matches a configured remotePattern', async () => {
    const { optimizeService } = stubStrapi({
      remotePatterns: [{ protocol: 'https', hostname: 'storage.googleapis.com' }],
    });
    const ctx = makeMockCtx({
      url: 'https://storage.googleapis.com/bucket/img.jpg',
      w: '640',
      q: '75',
    });
    await imageOptimizeController.optimize(ctx, async () => {});

    expect(ctx.status).toBe(200);
    expect(optimizeService.optimize).toHaveBeenCalledWith(
      expect.objectContaining({ isRemote: true }),
    );
  });

  it('returns 400 for a width not in deviceSizes or imageSizes', async () => {
    stubStrapi();
    await assertValidationError({ url: '/uploads/img.jpg', w: '999', q: '75' }, /"w"/);
  });

  it('returns 400 for quality below 1', async () => {
    stubStrapi();
    await assertValidationError({ url: '/uploads/img.jpg', w: '640', q: '0' }, /"q"/);
  });

  it('returns 400 for quality above 100', async () => {
    stubStrapi();
    const ctx = makeMockCtx({ url: '/uploads/img.jpg', w: '640', q: '101' });
    await imageOptimizeController.optimize(ctx, async () => {});
    expect(ctx.status).toBe(400);
  });

  it('serves an optimized image with correct headers on success', async () => {
    stubStrapi();
    const ctx = makeMockCtx({ url: '/uploads/photo.jpg', w: '640', q: '75' });
    await imageOptimizeController.optimize(ctx, async () => {});

    expect(ctx.status).toBe(200);
    expect(ctx.set).toHaveBeenCalledWith('Content-Type', 'image/webp');
    expect(ctx.set).toHaveBeenCalledWith('ETag', 'testEtag');
    expect(ctx.set).toHaveBeenCalledWith('Vary', 'Accept');
    expect(ctx.set).toHaveBeenCalledWith('Cache-Control', expect.stringContaining('max-age='));
    expect(ctx.body).toEqual(Buffer.from('image-bytes'));
  });

  it('sets Cache-Control: public, max-age=0 in non-production env', async () => {
    stubStrapi();
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      const ctx = makeMockCtx({ url: '/uploads/photo.jpg', w: '640', q: '75' });
      await imageOptimizeController.optimize(ctx, async () => {});
      expect(ctx.set).toHaveBeenCalledWith('Cache-Control', 'public, max-age=0, must-revalidate');
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  it('returns 304 via the fast ETag path when cache peekEtag matches If-None-Match', async () => {
    const { cacheService } = stubStrapi();
    cacheService.peekEtag.mockResolvedValue({ etag: 'fast-etag', isStale: false });

    const ctx = makeMockCtx(
      { url: '/uploads/photo.jpg', w: '640', q: '75' },
      { 'if-none-match': 'fast-etag' },
    );
    await imageOptimizeController.optimize(ctx, async () => {});

    expect(ctx.status).toBe(304);
    expect(cacheService.peekEtag).toHaveBeenCalled();
  });

  it('returns 304 on final ETag match after optimize resolves', async () => {
    stubStrapi();
    // The mock optimize service returns etag 'testEtag'; send the same in If-None-Match
    const ctx = makeMockCtx(
      { url: '/uploads/photo.jpg', w: '640', q: '75' },
      { 'if-none-match': 'testEtag' },
    );
    await imageOptimizeController.optimize(ctx, async () => {});
    expect(ctx.status).toBe(304);
  });

  it('returns 404 when the optimize service throws an HttpError with status 404', async () => {
    const { optimizeService } = stubStrapi();
    const err = Object.assign(new Error('Image not found'), { status: 404 });
    optimizeService.optimize.mockRejectedValue(err);

    const ctx = makeMockCtx({ url: '/uploads/missing.jpg', w: '640', q: '75' });
    await imageOptimizeController.optimize(ctx, async () => {});

    expect(ctx.status).toBe(404);
    expect((ctx.body as Record<string, string>).error).toBe('Image not found');
  });

  it('returns 500 for unexpected errors from the optimize service', async () => {
    const { optimizeService } = stubStrapi();
    optimizeService.optimize.mockRejectedValue(new Error('unexpected'));

    const ctx = makeMockCtx({ url: '/uploads/photo.jpg', w: '640', q: '75' });
    await imageOptimizeController.optimize(ctx, async () => {});

    expect(ctx.status).toBe(500);
    expect((ctx.body as Record<string, string>).error).toMatch(/internal/i);
  });

  it('respects the f=webp query param for format selection', async () => {
    const { optimizeService } = stubStrapi();
    const ctx = makeMockCtx({ url: '/uploads/photo.jpg', w: '640', q: '75', f: 'webp' });
    await imageOptimizeController.optimize(ctx, async () => {});

    expect(optimizeService.optimize).toHaveBeenCalledWith(
      expect.objectContaining({ outputFormat: 'image/webp' }),
    );
  });

  it('respects the f=avif query param for format selection', async () => {
    const { optimizeService } = stubStrapi();
    const ctx = makeMockCtx({ url: '/uploads/photo.jpg', w: '640', q: '75', f: 'avif' });
    await imageOptimizeController.optimize(ctx, async () => {});

    expect(optimizeService.optimize).toHaveBeenCalledWith(
      expect.objectContaining({ outputFormat: 'image/avif' }),
    );
  });

  it('selects avif from Accept header when configured', async () => {
    const { optimizeService } = stubStrapi({ formats: ['image/webp', 'image/avif'] });

    const ctx = makeMockCtx(
      { url: '/uploads/photo.jpg', w: '640', q: '75' },
      { accept: 'image/avif,image/webp,*/*' },
    );
    await imageOptimizeController.optimize(ctx, async () => {});

    expect(optimizeService.optimize).toHaveBeenCalledWith(
      expect.objectContaining({ outputFormat: 'image/avif' }),
    );
  });

  it('defaults to null outputFormat when no Accept match and no f param', async () => {
    const { optimizeService } = stubStrapi();
    const ctx = makeMockCtx({ url: '/uploads/photo.jpg', w: '640', q: '75' });
    await imageOptimizeController.optimize(ctx, async () => {});

    expect(optimizeService.optimize).toHaveBeenCalledWith(
      expect.objectContaining({ outputFormat: null }),
    );
  });

  it('uses default quality of 75 when q param is absent', async () => {
    const { optimizeService } = stubStrapi();
    const ctx = makeMockCtx({ url: '/uploads/photo.jpg', w: '640' });
    await imageOptimizeController.optimize(ctx, async () => {});

    expect(optimizeService.optimize).toHaveBeenCalledWith(expect.objectContaining({ quality: 75 }));
  });
});
