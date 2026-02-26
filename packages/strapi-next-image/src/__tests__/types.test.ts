import { describe, it, expect } from 'vitest';
import { isStrapiMedia } from '../types';

describe('isStrapiMedia()', () => {
  it('returns true for valid StrapiMedia', () => {
    expect(
      isStrapiMedia({ id: 1, url: '/photo.jpg', width: 800, height: 600 })
    ).toBe(true);
  });

  it('returns true with optional fields', () => {
    expect(
      isStrapiMedia({
        id: 1,
        url: '/photo.jpg',
        width: 800,
        height: 600,
        alternativeText: 'A photo',
        formats: { thumbnail: { name: 'thumb', hash: 'h', ext: '.jpg', mime: 'image/jpeg', width: 100, height: 75, size: 5, url: '/thumb.jpg' } },
        mime: 'image/jpeg',
        blurDataURL: 'data:image/png;base64,abc',
      })
    ).toBe(true);
  });

  it('returns false for null', () => {
    expect(isStrapiMedia(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isStrapiMedia(undefined)).toBe(false);
  });

  it('returns false for string', () => {
    expect(isStrapiMedia('/photo.jpg')).toBe(false);
  });

  it('returns false for number', () => {
    expect(isStrapiMedia(42)).toBe(false);
  });

  it('returns false when url is missing', () => {
    expect(isStrapiMedia({ id: 1, width: 800, height: 600 })).toBe(false);
  });

  it('returns false when width is missing', () => {
    expect(isStrapiMedia({ id: 1, url: '/photo.jpg', height: 600 })).toBe(
      false
    );
  });

  it('returns false when height is missing', () => {
    expect(isStrapiMedia({ id: 1, url: '/photo.jpg', width: 800 })).toBe(
      false
    );
  });

  it('returns false when url is not a string', () => {
    expect(isStrapiMedia({ id: 1, url: 123, width: 800, height: 600 })).toBe(
      false
    );
  });
});
