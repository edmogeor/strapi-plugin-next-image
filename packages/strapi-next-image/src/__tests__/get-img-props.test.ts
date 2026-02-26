import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getImgProps } from '../get-img-props';
import { imageConfigDefault } from '../image-config';
import defaultLoader from '../image-loader';
import type { ImageProps, StrapiMedia } from '../types';

const defaults = {
  defaultLoader,
  imgConf: imageConfigDefault,
};

function call(props: ImageProps) {
  return getImgProps(props, defaults);
}

describe('getImgProps() — StrapiMedia handling', () => {
  const media: StrapiMedia = {
    id: 1,
    url: '/uploads/photo.jpg',
    width: 800,
    height: 600,
    alternativeText: 'A photo',
  };

  it('extracts url/width/height/alt from StrapiMedia', () => {
    const { props } = call({ src: media, alt: '' });
    expect(props.src).toContain(encodeURIComponent('/uploads/photo.jpg'));
    expect(props.width).toBe(800);
    expect(props.height).toBe(600);
    expect(props.alt).toBe('A photo');
  });

  it('auto-calculates height from width', () => {
    const { props } = call({ src: media, alt: '', width: 400 });
    expect(props.width).toBe(400);
    expect(props.height).toBe(300); // 400/800 * 600
  });

  it('auto-calculates width from height', () => {
    const { props } = call({ src: media, alt: '', height: 300 });
    expect(props.width).toBe(400); // 300/600 * 800
    expect(props.height).toBe(300);
  });

  it('uses media.blurDataURL', () => {
    const mediaWithBlur: StrapiMedia = {
      ...media,
      blurDataURL: 'data:image/png;base64,abc',
    };
    const { props } = call({
      src: mediaWithBlur,
      alt: '',
      placeholder: 'blur',
    });
    expect(props.style.backgroundImage).toContain('data:image/png;base64,abc');
  });

  it('explicit alt overrides alternativeText', () => {
    const { props } = call({ src: media, alt: 'Custom alt' });
    expect(props.alt).toBe('Custom alt');
  });

  it('StrapiMedia with fill — no width/height errors', () => {
    const { props, meta } = call({ src: media, alt: '', fill: true });
    expect(meta.fill).toBe(true);
    expect(props.width).toBeUndefined();
    expect(props.height).toBeUndefined();
  });
});

describe('getImgProps() — dev-mode errors', () => {
  it('throws for fill + width', () => {
    expect(() =>
      call({ src: '/test.png', alt: '', fill: true, width: 100 })
    ).toThrow('has both "width" and "fill"');
  });

  it('throws for fill + height', () => {
    expect(() =>
      call({ src: '/test.png', alt: '', fill: true, height: 100 })
    ).toThrow('has both "height" and "fill"');
  });

  it('throws for fill + style.position', () => {
    expect(() =>
      call({
        src: '/test.png',
        alt: '',
        fill: true,
        style: { position: 'relative' },
      })
    ).toThrow('both "fill" and "style.position"');
  });

  it('throws for fill + style.width', () => {
    expect(() =>
      call({
        src: '/test.png',
        alt: '',
        fill: true,
        style: { width: '50%' },
      })
    ).toThrow('both "fill" and "style.width"');
  });

  it('throws for fill + style.height', () => {
    expect(() =>
      call({
        src: '/test.png',
        alt: '',
        fill: true,
        style: { height: '50%' },
      })
    ).toThrow('both "fill" and "style.height"');
  });

  it('throws for missing width (string src, no fill)', () => {
    expect(() =>
      call({ src: '/test.png', alt: '', height: 100 })
    ).toThrow('missing required "width"');
  });

  it('throws for missing height (string src, no fill)', () => {
    expect(() =>
      call({ src: '/test.png', alt: '', width: 100 })
    ).toThrow('missing required "height"');
  });

  it('throws for invalid width (NaN)', () => {
    expect(() =>
      call({
        src: '/test.png',
        alt: '',
        width: 'abc' as any,
        height: 100,
      })
    ).toThrow('invalid "width"');
  });

  it('throws for invalid height (NaN)', () => {
    expect(() =>
      call({
        src: '/test.png',
        alt: '',
        width: 100,
        height: 'abc' as any,
      })
    ).toThrow('invalid "height"');
  });

  it('throws for invalid loading value', () => {
    expect(() =>
      call({
        src: '/test.png',
        alt: '',
        width: 100,
        height: 100,
        loading: 'invalid' as any,
      })
    ).toThrow('invalid "loading"');
  });

  it('throws for priority + loading=lazy', () => {
    expect(() =>
      call({
        src: '/test.png',
        alt: '',
        width: 100,
        height: 100,
        priority: true,
        loading: 'lazy',
      })
    ).toThrow('both "priority" and "loading=\'lazy\'"');
  });

  it('throws for priority + loading=lazy', () => {
    expect(() =>
      call({
        src: '/test.png',
        alt: '',
        width: 100,
        height: 100,
        priority: true,
        loading: 'lazy',
      })
    ).toThrow('both "priority" and "loading=\'lazy\'"');
  });


  it('throws for invalid placeholder', () => {
    expect(() =>
      call({
        src: '/test.png',
        alt: '',
        width: 100,
        height: 100,
        placeholder: 'invalid' as any,
      })
    ).toThrow('invalid "placeholder"');
  });

  it('throws for blur without blurDataURL', () => {
    expect(() =>
      call({
        src: '/test.png',
        alt: '',
        width: 100,
        height: 100,
        placeholder: 'blur',
      })
    ).toThrow('missing the "blurDataURL"');
  });

  it('throws for src with leading whitespace', () => {
    expect(() =>
      call({ src: ' /test.png', alt: '', width: 100, height: 100 })
    ).toThrow('cannot start with a space');
  });

  it('throws for src with trailing whitespace', () => {
    expect(() =>
      call({ src: '/test.png ', alt: '', width: 100, height: 100 })
    ).toThrow('cannot end with a space');
  });
});

describe('getImgProps() — dev-mode warnings', () => {
  let warningMessages: string[];
  const originalWarn = console.warn;

  beforeEach(() => {
    warningMessages = [];
    console.warn = (m: string) => {
      warningMessages.push(m);
    };
  });

  afterEach(() => {
    console.warn = originalWarn;
  });

  it('warns when quality not in config', () => {
    // Use unique src to avoid warnOnce dedup
    call({
      src: '/warn-quality.png',
      alt: '',
      width: 100,
      height: 100,
      quality: 50,
    });
    expect(warningMessages.some((m) => m.includes('quality "50"'))).toBe(true);
  });

  it('warns about loader not implementing width', () => {
    call({
      src: '/warn-loader.png',
      alt: '',
      width: 100,
      height: 100,
      loader: ({ src }) => src, // returns src unchanged
    });
    expect(
      warningMessages.some((m) => m.includes('does not implement width'))
    ).toBe(true);
  });

  it('warns about deprecated onLoadingComplete', () => {
    call({
      src: '/warn-olc.png',
      alt: '',
      width: 100,
      height: 100,
      onLoadingComplete: () => { },
    });
    expect(
      warningMessages.some((m) => m.includes('deprecated "onLoadingComplete"'))
    ).toBe(true);
  });

  it('warns about ref in rest', () => {
    call({
      src: '/warn-ref.png',
      alt: '',
      width: 100,
      height: 100,
      // @ts-expect-error testing ref warning
      ref: { current: null },
    });
    expect(
      warningMessages.some((m) => m.includes('unsupported "ref"'))
    ).toBe(true);
  });

  it('warns about legacy layout prop', () => {
    call({
      src: '/warn-layout.png',
      alt: '',
      width: 100,
      height: 100,
      layout: 'responsive',
    });
    expect(
      warningMessages.some((m) => m.includes('legacy prop "layout"'))
    ).toBe(true);
  });

  it('warns about legacy objectFit prop', () => {
    call({
      src: '/warn-of.png',
      alt: '',
      width: 100,
      height: 100,
      objectFit: 'cover',
    });
    expect(
      warningMessages.some((m) => m.includes('legacy prop "objectFit"'))
    ).toBe(true);
  });

  it('warns about legacy objectPosition prop', () => {
    call({
      src: '/warn-op.png',
      alt: '',
      width: 100,
      height: 100,
      objectPosition: 'center',
    });
    expect(
      warningMessages.some((m) => m.includes('legacy prop "objectPosition"'))
    ).toBe(true);
  });

  it('warns about small image with placeholder', () => {
    call({
      src: '/warn-small.png',
      alt: '',
      width: 10,
      height: 10,
      placeholder: 'blur',
      blurDataURL: 'data:image/png;base64,abc',
    });
    expect(
      warningMessages.some((m) => m.includes('smaller than 40x40'))
    ).toBe(true);
  });
});

describe('getImgProps() — legacy layout prop', () => {
  it('layout=fill sets fill=true and sizes=100vw', () => {
    const { props, meta } = call({
      src: '/test.png',
      alt: '',
      layout: 'fill',
    });
    expect(meta.fill).toBe(true);
    expect(props.sizes).toBe('100vw');
    expect(props.style.position).toBe('absolute');
  });

  it('layout=responsive sets width:100%, height:auto, sizes:100vw', () => {
    const { props } = call({
      src: '/test.png',
      alt: '',
      width: 100,
      height: 100,
      layout: 'responsive',
    });
    expect(props.style.width).toBe('100%');
    expect(props.style.height).toBe('auto');
    expect(props.sizes).toBe('100vw');
  });

  it('layout=intrinsic sets maxWidth:100%, height:auto', () => {
    const { props } = call({
      src: '/test.png',
      alt: '',
      width: 100,
      height: 100,
      layout: 'intrinsic',
    });
    expect(props.style.maxWidth).toBe('100%');
    expect(props.style.height).toBe('auto');
  });
});

describe('getImgProps() — placeholder styles', () => {
  it('blur placeholder has backgroundImage with SVG data URL', () => {
    const { props } = call({
      src: '/test.png',
      alt: '',
      width: 100,
      height: 100,
      placeholder: 'blur',
      blurDataURL: 'data:image/png;base64,abc',
    });
    expect(props.style.backgroundImage).toContain(
      'data:image/svg+xml;charset=utf-8,'
    );
    expect(props.style.backgroundSize).toBeDefined();
    expect(props.style.backgroundPosition).toBeDefined();
    expect(props.style.backgroundRepeat).toBe('no-repeat');
  });

  it('data:image/ placeholder uses custom URL', () => {
    const { props } = call({
      src: '/test.png',
      alt: '',
      width: 100,
      height: 100,
      placeholder: 'data:image/png;base64,custom',
    });
    expect(props.style.backgroundImage).toBe(
      'url("data:image/png;base64,custom")'
    );
  });

  it('empty placeholder has no background styles', () => {
    const { props } = call({
      src: '/test.png',
      alt: '',
      width: 100,
      height: 100,
      placeholder: 'empty',
    });
    expect(props.style.backgroundImage).toBeUndefined();
    expect(props.style.backgroundSize).toBeUndefined();
  });
});
