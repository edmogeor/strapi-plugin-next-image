import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getImageProps } from '../get-image-props';

// Helper to build expected Strapi optimize URL
function opt(src: string, w: number, q = 75) {
  return `/api/image-optimize?url=${encodeURIComponent(src)}&w=${w}&q=${q}`;
}

describe('getImageProps()', () => {
  let warningMessages: string[];
  const originalConsoleWarn = console.warn;

  beforeEach(() => {
    warningMessages = [];
    console.warn = (m: string) => {
      warningMessages.push(m);
    };
  });

  afterEach(() => {
    console.warn = originalConsoleWarn;
  });

  it('should return props in correct order', () => {
    const { props } = getImageProps({
      alt: 'a nice desc',
      id: 'my-image',
      src: '/test.png',
      width: 100,
      height: 200,
    });
    expect(Object.entries(props)).toStrictEqual([
      ['id', 'my-image'],
      ['alt', 'a nice desc'],
      ['loading', 'lazy'],
      ['fetchPriority', undefined],
      ['width', 100],
      ['height', 200],
      ['decoding', 'async'],
      ['className', undefined],
      ['style', { color: 'transparent' }],
      ['sizes', undefined],
      ['srcSet', `${opt('/test.png', 128)} 1x, ${opt('/test.png', 256)} 2x`],
      ['src', opt('/test.png', 256)],
    ]);
  });

  it('should have correct types for all props', () => {
    const { props } = getImageProps({
      alt: 'a nice desc',
      id: 'my-image',
      src: '/test.png',
      width: 100,
      height: 200,
    });

    expect(typeof props.alt).toBe('string');
    expect(typeof props.loading).toBe('string');
    expect(typeof props.width).toBe('number');
    expect(typeof props.height).toBe('number');
    expect(typeof props.decoding).toBe('string');
    expect(typeof props.style).toBe('object');
    expect(typeof props.src).toBe('string');
    expect(typeof props.srcSet).toBe('string');
  });

  it('should handle priority', () => {
    const { props, meta } = getImageProps({
      alt: 'a nice desc',
      id: 'my-image',
      src: '/test.png',
      width: 100,
      height: 200,
      priority: true,
    });
    expect(warningMessages).toStrictEqual([]);
    expect(meta.priority).toBe(true);
    // loading should not be 'lazy' when prioritized
    expect(props.loading).toBeUndefined();
  });

  it('should handle priority (deprecated)', () => {
    const { props, meta } = getImageProps({
      alt: 'a nice desc',
      id: 'my-image',
      src: '/test.png',
      width: 100,
      height: 200,
      priority: true,
    });
    expect(meta.priority).toBe(true);
    expect(props.loading).toBeUndefined();
  });



  it('should handle fetchPriority', () => {
    const { props } = getImageProps({
      alt: 'a nice desc',
      id: 'my-image',
      src: '/test.png',
      width: 100,
      height: 200,
      fetchPriority: 'high',
    });
    expect(warningMessages).toStrictEqual([]);
    expect(props.fetchPriority).toBe('high');
  });

  it('should warn when quality is not in config', () => {
    const { props } = getImageProps({
      alt: 'a nice desc',
      src: '/test-q50.png',
      width: 100,
      height: 200,
      quality: 50,
    });
    expect(warningMessages.length).toBe(1);
    expect(warningMessages[0]).toContain('quality "50"');
    expect(warningMessages[0]).toContain('not configured');
    // srcSet still uses the provided quality
    expect(props.srcSet).toContain('q=50');
  });

  it('should not warn when quality matches config', () => {
    const { props } = getImageProps({
      alt: 'a nice desc',
      src: '/test.png',
      width: 100,
      height: 200,
      quality: 75,
    });
    expect(warningMessages).toStrictEqual([]);
    expect(props.srcSet).toContain('q=75');
  });

  it('should handle quality as string', () => {
    const { props } = getImageProps({
      alt: 'a nice desc',
      src: '/test-qs.png',
      width: 100,
      height: 200,
      quality: '75',
    });
    expect(warningMessages).toStrictEqual([]);
    expect(props.srcSet).toContain('q=75');
  });

  it('should handle loading: eager', () => {
    const { props } = getImageProps({
      alt: 'a nice desc',
      id: 'my-image',
      src: '/test.png',
      width: 100,
      height: 200,
      loading: 'eager',
    });
    expect(warningMessages).toStrictEqual([]);
    expect(props.loading).toBe('eager');
  });

  it('should handle 16px image', () => {
    const { props } = getImageProps({
      alt: 'a nice desc',
      src: '/test.png',
      width: 16,
      height: 16,
    });
    // 16 → closest allSize >= 16 is 32; 32 → closest >= 32 is 32; Set dedupes → [32]
    expect(props.srcSet).toBe(`${opt('/test.png', 32)} 1x`);
    expect(props.src).toBe(opt('/test.png', 32));
  });

  it('should handle 32px image', () => {
    const { props } = getImageProps({
      alt: 'a nice desc',
      src: '/test.png',
      width: 32,
      height: 32,
    });
    // 32 → 32; 64 → 64; widths = [32, 64]
    expect(props.srcSet).toBe(
      `${opt('/test.png', 32)} 1x, ${opt('/test.png', 64)} 2x`
    );
    expect(props.src).toBe(opt('/test.png', 64));
  });

  it('should handle 256px image', () => {
    const { props } = getImageProps({
      alt: 'a nice desc',
      src: '/test.png',
      width: 256,
      height: 256,
    });
    // 256 → 256; 512 → 640; widths = [256, 640]
    expect(props.srcSet).toBe(
      `${opt('/test.png', 256)} 1x, ${opt('/test.png', 640)} 2x`
    );
    expect(props.src).toBe(opt('/test.png', 640));
  });

  it('should handle 512px image', () => {
    const { props } = getImageProps({
      alt: 'a nice desc',
      src: '/test.png',
      width: 512,
      height: 512,
    });
    // 512 → 640; 1024 → 1080; widths = [640, 1080]
    expect(props.srcSet).toBe(
      `${opt('/test.png', 640)} 1x, ${opt('/test.png', 1080)} 2x`
    );
    expect(props.src).toBe(opt('/test.png', 1080));
  });

  it('should handle 3072px image', () => {
    const { props } = getImageProps({
      alt: 'a nice desc',
      src: '/test.png',
      width: 3072,
      height: 3072,
    });
    // 3072 → 3840; 6144 → 3840 (last); Set dedupes → [3840]
    expect(props.srcSet).toBe(`${opt('/test.png', 3840)} 1x`);
    expect(props.src).toBe(opt('/test.png', 3840));
  });

  it('should handle sizes=100vw', () => {
    const { props } = getImageProps({
      alt: 'a nice desc',
      src: '/test.png',
      width: 100,
      height: 200,
      sizes: '100vw',
    });
    expect(warningMessages).toStrictEqual([]);
    expect(props.sizes).toBe('100vw');
    // All allSizes (deviceSizes + imageSizes sorted) that are >= deviceSizes[0] * 1.0
    // deviceSizes[0] = 640, 100vw → smallestRatio = 1.0
    // allSizes >= 640: [640, 750, 828, 1080, 1200, 1920, 2048, 3840]
    const expectedWidths = [640, 750, 828, 1080, 1200, 1920, 2048, 3840];
    const expectedSrcSet = expectedWidths
      .map((w) => `${opt('/test.png', w)} ${w}w`)
      .join(', ');
    expect(props.srcSet).toBe(expectedSrcSet);
    expect(props.src).toBe(opt('/test.png', 3840));
  });

  it('should handle fill mode', () => {
    const { props, meta } = getImageProps({
      alt: 'a nice desc',
      id: 'my-image',
      src: '/test.png',
      fill: true,
    });
    expect(warningMessages).toStrictEqual([]);
    expect(meta.fill).toBe(true);
    expect(props.width).toBeUndefined();
    expect(props.height).toBeUndefined();
    expect(props.style).toMatchObject({
      position: 'absolute',
      width: '100%',
      height: '100%',
    });
    expect(props.sizes).toBe('100vw');
  });

  it('should handle style merging', () => {
    const { props } = getImageProps({
      alt: 'a nice desc',
      src: '/test.png',
      width: 100,
      height: 200,
      style: { maxWidth: '100%', height: 'auto' },
    });
    expect(props.style).toStrictEqual({
      color: 'transparent',
      maxWidth: '100%',
      height: 'auto',
    });
  });

  it('should handle custom loader', () => {
    const { props } = getImageProps({
      alt: 'a nice desc',
      src: '/test.png',
      width: 100,
      height: 200,
      loader: ({ src, width, quality }) =>
        `https://example.com${src}?w=${width}&q=${quality || 75}`,
    });
    expect(props.srcSet).toBe(
      'https://example.com/test.png?w=128&q=75 1x, https://example.com/test.png?w=256&q=75 2x'
    );
    expect(props.src).toBe('https://example.com/test.png?w=256&q=75');
  });

  it('should pass through arbitrary props', () => {
    const { props } = getImageProps({
      alt: 'a nice desc',
      src: '/test.png',
      width: 100,
      height: 200,
      // @ts-expect-error testing arbitrary props
      'data-testid': 'hero',
      'aria-label': 'Hero image',
      id: 'hero-img',
    });
    expect((props as any)['data-testid']).toBe('hero');
    expect((props as any)['aria-label']).toBe('Hero image');
    expect((props as any).id).toBe('hero-img');
  });

  it('should handle overrideSrc', () => {
    const { props } = getImageProps({
      alt: 'a nice desc',
      src: '/test.png',
      overrideSrc: '/override.png',
      width: 100,
      height: 200,
    });
    expect(props.src).toBe('/override.png');
    // srcSet should still use original src
    expect(props.srcSet).toContain(encodeURIComponent('/test.png'));
  });

  it('should handle decoding: sync', () => {
    const { props } = getImageProps({
      alt: 'a nice desc',
      src: '/test.png',
      decoding: 'sync',
      width: 100,
      height: 200,
    });
    expect(props.decoding).toBe('sync');
  });

  it('should auto-unoptimize relative SVG', () => {
    const { props, meta } = getImageProps({
      alt: 'a nice desc',
      src: '/test.svg',
      width: 100,
      height: 200,
    });
    expect(meta.unoptimized).toBe(true);
    expect(props.srcSet).toBeUndefined();
    expect(props.src).toBe('/test.svg');
  });

  it('should auto-unoptimize absolute SVG', () => {
    const { props, meta } = getImageProps({
      alt: 'a nice desc',
      src: 'https://example.com/test.svg',
      width: 100,
      height: 200,
    });
    expect(meta.unoptimized).toBe(true);
    expect(props.srcSet).toBeUndefined();
    expect(props.src).toBe('https://example.com/test.svg');
  });

  it('should auto-unoptimize SVG with query string', () => {
    const { props } = getImageProps({
      alt: 'a nice desc',
      src: 'https://example.com/test.svg?v=1',
      width: 100,
      height: 200,
    });
    expect(props.srcSet).toBeUndefined();
    expect(props.src).toBe('https://example.com/test.svg?v=1');
  });

  it('should handle unoptimized flag', () => {
    const { props, meta } = getImageProps({
      alt: 'a nice desc',
      src: '/test.png',
      width: 100,
      height: 200,
      unoptimized: true,
    });
    expect(meta.unoptimized).toBe(true);
    expect(props.srcSet).toBeUndefined();
    expect(props.src).toBe('/test.png');
  });
});
