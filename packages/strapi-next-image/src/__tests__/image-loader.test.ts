import { describe, it, expect } from 'vitest';
import defaultLoader, { createStrapiLoader } from '../image-loader';
import type { ImageConfig } from '../types';

const dummyConfig = {} as ImageConfig;

describe('strapiLoader (default)', () => {
  it('generates correct URL format', () => {
    const url = defaultLoader({
      config: dummyConfig,
      src: '/uploads/photo.jpg',
      width: 640,
    });
    expect(url).toBe(
      '/api/image-optimize?url=%2Fuploads%2Fphoto.jpg&w=640&q=75'
    );
  });

  it('URL-encodes src', () => {
    const url = defaultLoader({
      config: dummyConfig,
      src: '/uploads/my photo (1).jpg',
      width: 640,
    });
    expect(url).toContain(
      `url=${encodeURIComponent('/uploads/my photo (1).jpg')}`
    );
  });

  it('uses provided quality', () => {
    const url = defaultLoader({
      config: dummyConfig,
      src: '/test.png',
      width: 100,
      quality: 50,
    });
    expect(url).toContain('q=50');
  });

  it('defaults quality to 75', () => {
    const url = defaultLoader({
      config: dummyConfig,
      src: '/test.png',
      width: 100,
    });
    expect(url).toContain('q=75');
  });

  it('has __strapi_img_default marker', () => {
    expect('__strapi_img_default' in defaultLoader).toBe(true);
  });
});

describe('createStrapiLoader()', () => {
  it('prepends base URL', () => {
    const loader = createStrapiLoader('http://localhost:1337');
    const url = loader({
      config: dummyConfig,
      src: '/uploads/photo.jpg',
      width: 640,
    });
    expect(url).toBe(
      'http://localhost:1337/api/image-optimize?url=%2Fuploads%2Fphoto.jpg&w=640&q=75'
    );
  });

  it('strips trailing slash from base URL', () => {
    const loader = createStrapiLoader('http://example.com/');
    const url = loader({
      config: dummyConfig,
      src: '/test.png',
      width: 100,
    });
    expect(url.startsWith('http://example.com/api/')).toBe(true);
    expect(url).not.toContain('//api/');
  });

  it('has __strapi_img_default marker', () => {
    const loader = createStrapiLoader('http://localhost:1337');
    expect('__strapi_img_default' in loader).toBe(true);
  });
});
