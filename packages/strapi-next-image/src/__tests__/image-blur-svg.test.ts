import { describe, it, expect } from 'vitest';
import { getImageBlurSvg } from '../image-blur-svg';

describe('getImageBlurSvg()', () => {
  it('generates SVG with viewBox when dimensions given', () => {
    const svg = getImageBlurSvg({
      widthInt: 100,
      heightInt: 50,
      blurDataURL: 'data:image/png;base64,abc',
    });
    expect(svg).toContain("viewBox='0 0 100 50'");
  });

  it('uses blurWidth*40 for svgWidth', () => {
    const svg = getImageBlurSvg({
      widthInt: 100,
      heightInt: 50,
      blurWidth: 8,
      blurHeight: 4,
      blurDataURL: 'data:image/png;base64,abc',
    });
    expect(svg).toContain("viewBox='0 0 320 160'"); // 8*40=320, 4*40=160
  });

  it('uses blurHeight*40 for svgHeight', () => {
    const svg = getImageBlurSvg({
      blurWidth: 10,
      blurHeight: 5,
      blurDataURL: 'data:image/png;base64,abc',
    });
    expect(svg).toContain("viewBox='0 0 400 200'"); // 10*40, 5*40
  });

  it('falls back to widthInt/heightInt when blurWidth/blurHeight not given', () => {
    const svg = getImageBlurSvg({
      widthInt: 200,
      heightInt: 100,
      blurDataURL: 'data:image/png;base64,abc',
    });
    expect(svg).toContain("viewBox='0 0 200 100'");
  });

  it('preserveAspectRatio is none when viewBox present', () => {
    const svg = getImageBlurSvg({
      widthInt: 100,
      heightInt: 100,
      blurDataURL: 'data:image/png;base64,abc',
    });
    expect(svg).toContain("preserveAspectRatio='none'");
  });

  it('objectFit=contain without viewBox sets xMidYMid', () => {
    const svg = getImageBlurSvg({
      blurDataURL: 'data:image/png;base64,abc',
      objectFit: 'contain',
    });
    // No viewBox (no dimensions)
    expect(svg).not.toContain('viewBox');
    expect(svg).toContain("preserveAspectRatio='xMidYMid'");
  });

  it('objectFit=cover without viewBox sets xMidYMid slice', () => {
    const svg = getImageBlurSvg({
      blurDataURL: 'data:image/png;base64,abc',
      objectFit: 'cover',
    });
    expect(svg).not.toContain('viewBox');
    expect(svg).toContain("preserveAspectRatio='xMidYMid slice'");
  });

  it('embeds blurDataURL in SVG', () => {
    const svg = getImageBlurSvg({
      widthInt: 100,
      heightInt: 100,
      blurDataURL: 'data:image/jpeg;base64,/9j/4AAQ',
    });
    expect(svg).toContain("href='data:image/jpeg;base64,/9j/4AAQ'");
  });

  it('returns URL-encoded SVG', () => {
    const svg = getImageBlurSvg({
      widthInt: 100,
      heightInt: 100,
      blurDataURL: 'data:image/png;base64,abc',
    });
    expect(svg).toMatch(/^%3Csvg/);
    expect(svg).toMatch(/%3C\/svg%3E$/);
  });
});
