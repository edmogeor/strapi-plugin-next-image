import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import createCacheService from '../services/cache';
import type { InvalidateConfig } from '../services/cache';

const cacheService = createCacheService();
const cacheDir = cacheService.getCacheDir();

const testConfig: InvalidateConfig = {
  deviceSizes: [640, 1080],
  imageSizes: [64, 128],
  qualities: [75],
  formats: ['image/webp'],
};

function seedCacheEntry(url: string, width: number, quality: number, format: string) {
  const key = cacheService.getCacheKey(url, width, quality, format);
  const entryDir = path.join(cacheDir, key);
  fs.mkdirSync(entryDir, { recursive: true });
  fs.writeFileSync(path.join(entryDir, '14400.9999999999999.abc123.webp'), 'fake');
}

describe('cache invalidateUrl', () => {
  beforeEach(() => {
    fs.mkdirSync(cacheDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  it('removes all variant directories for a given URL', () => {
    const url = '/uploads/photo_abc123.jpg';

    // Seed cache entries for all configured variants
    for (const w of [...testConfig.deviceSizes, ...testConfig.imageSizes]) {
      for (const q of testConfig.qualities) {
        seedCacheEntry(url, w, q, 'webp');
        seedCacheEntry(url, w, q, 'original');
      }
    }

    // Verify entries exist
    const entriesBefore = fs.readdirSync(cacheDir);
    expect(entriesBefore.length).toBe(8); // 4 widths × 1 quality × 2 formats

    cacheService.invalidateUrl(url, testConfig);

    const entriesAfter = fs.readdirSync(cacheDir);
    expect(entriesAfter.length).toBe(0);
  });

  it('does not remove cache entries for other URLs', () => {
    const urlA = '/uploads/photo_a.jpg';
    const urlB = '/uploads/photo_b.jpg';

    seedCacheEntry(urlA, 640, 75, 'webp');
    seedCacheEntry(urlB, 640, 75, 'webp');

    const entriesBefore = fs.readdirSync(cacheDir);
    expect(entriesBefore.length).toBe(2);

    cacheService.invalidateUrl(urlA, testConfig);

    const entriesAfter = fs.readdirSync(cacheDir);
    expect(entriesAfter.length).toBe(1);

    // Verify urlB's entry still exists
    const keyB = cacheService.getCacheKey(urlB, 640, 75, 'webp');
    expect(fs.existsSync(path.join(cacheDir, keyB))).toBe(true);
  });

  it('handles multiple formats (webp + avif + original)', () => {
    const url = '/uploads/multi.jpg';
    const multiFormatConfig: InvalidateConfig = {
      deviceSizes: [640],
      imageSizes: [],
      qualities: [75],
      formats: ['image/webp', 'image/avif'],
    };

    seedCacheEntry(url, 640, 75, 'webp');
    seedCacheEntry(url, 640, 75, 'avif');
    seedCacheEntry(url, 640, 75, 'original');

    expect(fs.readdirSync(cacheDir).length).toBe(3);

    cacheService.invalidateUrl(url, multiFormatConfig);

    expect(fs.readdirSync(cacheDir).length).toBe(0);
  });

  it('is a no-op when cache directory does not exist', () => {
    fs.rmSync(cacheDir, { recursive: true, force: true });

    // Should not throw
    expect(() => {
      cacheService.invalidateUrl('/uploads/missing.jpg', testConfig);
    }).not.toThrow();
  });

  it('handles multiple qualities', () => {
    const url = '/uploads/quality.jpg';
    const multiQualityConfig: InvalidateConfig = {
      deviceSizes: [640],
      imageSizes: [],
      qualities: [50, 75, 90],
      formats: ['image/webp'],
    };

    seedCacheEntry(url, 640, 50, 'webp');
    seedCacheEntry(url, 640, 75, 'webp');
    seedCacheEntry(url, 640, 90, 'webp');
    seedCacheEntry(url, 640, 50, 'original');
    seedCacheEntry(url, 640, 75, 'original');
    seedCacheEntry(url, 640, 90, 'original');

    expect(fs.readdirSync(cacheDir).length).toBe(6);

    cacheService.invalidateUrl(url, multiQualityConfig);

    expect(fs.readdirSync(cacheDir).length).toBe(0);
  });
});
