import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import type { Core } from '@strapi/types';

// ---------------------------------------------------------------------------
// fs/promises mock — intercepts the static import in blur-placeholder.ts
// ---------------------------------------------------------------------------

const { mockReadFile } = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
}));

vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs/promises')>();
  return { ...actual, readFile: mockReadFile };
});

import { JPEG_1x1, WEBP_1x1, createImageFixtures } from './image-fixtures';
import createBlurPlaceholderService from '../services/blur-placeholder';

// ---------------------------------------------------------------------------
// Shared test fixtures — real image buffers so sharp can actually process them
// ---------------------------------------------------------------------------

beforeAll(createImageFixtures);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStrapi(blurSize = 8) {
  const mockRepo = {
    findOne: vi.fn(),
    update: vi.fn(),
  };
  const mockStrapi = {
    db: { query: vi.fn().mockReturnValue(mockRepo) },
    log: { error: vi.fn(), warn: vi.fn() },
    config: { get: vi.fn().mockReturnValue({ blurSize }) },
  } as unknown as Core.Strapi;
  return { mockStrapi, mockRepo };
}

async function expectBlurGeneratesDataURL(blurSize: number, pattern: RegExp): Promise<void> {
  const { mockStrapi } = makeStrapi(blurSize);
  mockReadFile.mockResolvedValue(JPEG_1x1);
  const svc = createBlurPlaceholderService({ strapi: mockStrapi });
  const result = await svc.generate('/uploads/photo.jpg', 'image/jpeg');
  expect(result).toMatch(pattern);
}

function setupConfirmedBlur() {
  const { mockStrapi, mockRepo } = makeStrapi();
  mockRepo.findOne.mockResolvedValue({ id: 1, mime: 'image/jpeg', blurDataURL: 'data:...' });
  const svc = createBlurPlaceholderService({ strapi: mockStrapi });
  return { mockStrapi, mockRepo, svc };
}

// ---------------------------------------------------------------------------
// generate()
// ---------------------------------------------------------------------------

describe('blurPlaceholderService.generate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null for unsupported mime types', async () => {
    const { mockStrapi } = makeStrapi();
    const svc = createBlurPlaceholderService({ strapi: mockStrapi });
    expect(await svc.generate('/uploads/doc.pdf', 'application/pdf')).toBeNull();
    expect(await svc.generate('/uploads/vid.mp4', 'video/mp4')).toBeNull();
    expect(await svc.generate('/uploads/icon.svg', 'image/svg+xml')).toBeNull();
  });

  it('returns null when the file cannot be read', async () => {
    const { mockStrapi } = makeStrapi();
    mockReadFile.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    const svc = createBlurPlaceholderService({ strapi: mockStrapi });
    expect(await svc.generate('/uploads/missing.jpg', 'image/jpeg')).toBeNull();
  });

  it('returns null for animated GIFs (multiple 0x2c bytes)', async () => {
    const { mockStrapi } = makeStrapi();
    const gifBuf = Buffer.alloc(100, 0x00);
    gifBuf[10] = 0x2c;
    gifBuf[20] = 0x2c;
    mockReadFile.mockResolvedValue(gifBuf);
    const svc = createBlurPlaceholderService({ strapi: mockStrapi });
    expect(await svc.generate('/uploads/anim.gif', 'image/gif')).toBeNull();
  });

  it('returns null for animated WebP (ANIM/ANMF chunk)', async () => {
    const { mockStrapi } = makeStrapi();
    const webpBuf = Buffer.alloc(100, 0x00);
    webpBuf[10] = 0x41; // A
    webpBuf[11] = 0x4e; // N
    webpBuf[12] = 0x4d; // M
    webpBuf[13] = 0x46; // F
    mockReadFile.mockResolvedValue(webpBuf);
    const svc = createBlurPlaceholderService({ strapi: mockStrapi });
    expect(await svc.generate('/uploads/anim.webp', 'image/webp')).toBeNull();
  });

  it('returns null for animated PNG (acTL chunk)', async () => {
    const { mockStrapi } = makeStrapi();
    const pngBuf = Buffer.alloc(100, 0x00);
    pngBuf[10] = 0x61; // a
    pngBuf[11] = 0x63; // c
    pngBuf[12] = 0x54; // T
    pngBuf[13] = 0x4c; // L
    mockReadFile.mockResolvedValue(pngBuf);
    const svc = createBlurPlaceholderService({ strapi: mockStrapi });
    expect(await svc.generate('/uploads/anim.png', 'image/png')).toBeNull();
  });

  it('returns a data URL for a valid JPEG', async () => {
    await expectBlurGeneratesDataURL(8, /^data:image\/jpeg;base64,/);
  });

  it('returns a data URL for a valid WebP', async () => {
    const { mockStrapi } = makeStrapi();
    mockReadFile.mockResolvedValue(WEBP_1x1);
    const svc = createBlurPlaceholderService({ strapi: mockStrapi });
    const result = await svc.generate('/uploads/photo.webp', 'image/webp');
    expect(result).toMatch(/^data:image\/jpeg;base64,/);
  });

  it('uses blurSize from plugin config', async () => {
    await expectBlurGeneratesDataURL(4, /^data:image\/jpeg;base64,/);
  });

  it('returns null and logs an error when sharp processing fails', async () => {
    const { mockStrapi } = makeStrapi();
    // Provide an invalid image buffer that sharp cannot process
    mockReadFile.mockResolvedValue(Buffer.from('not-a-real-image'));
    const svc = createBlurPlaceholderService({ strapi: mockStrapi });
    const result = await svc.generate('/uploads/corrupt.jpg', 'image/jpeg');
    expect(result).toBeNull();
    expect(mockStrapi.log.error).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// generateIfMissing()
// ---------------------------------------------------------------------------

describe('blurPlaceholderService.generateIfMissing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does nothing when the file record is not found in the DB', async () => {
    const { mockStrapi, mockRepo } = makeStrapi();
    mockRepo.findOne.mockResolvedValue(null);
    const svc = createBlurPlaceholderService({ strapi: mockStrapi });
    await svc.generateIfMissing('/uploads/ghost.jpg');
    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it('skips generation when the file already has a blurDataURL', async () => {
    const { mockStrapi, mockRepo } = makeStrapi();
    mockRepo.findOne.mockResolvedValue({
      id: 1,
      mime: 'image/jpeg',
      blurDataURL: 'data:image/jpeg;base64,existing',
    });
    const svc = createBlurPlaceholderService({ strapi: mockStrapi });
    await svc.generateIfMissing('/uploads/photo.jpg');
    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it('generates and persists a blur when blurDataURL is null', async () => {
    const { mockStrapi, mockRepo } = makeStrapi();
    mockRepo.findOne.mockResolvedValue({ id: 42, mime: 'image/jpeg', blurDataURL: null });
    mockRepo.update.mockResolvedValue({ id: 42 });
    mockReadFile.mockResolvedValue(JPEG_1x1);

    const svc = createBlurPlaceholderService({ strapi: mockStrapi });
    await svc.generateIfMissing('/uploads/new.jpg');

    expect(mockRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 42 },
        data: expect.objectContaining({
          blurDataURL: expect.stringMatching(/^data:image\/jpeg;base64,/),
        }),
      }),
    );
  });

  it('skips the DB lookup on second call for same URL after blur is confirmed', async () => {
    const { svc, mockRepo } = setupConfirmedBlur();

    await svc.generateIfMissing('/uploads/photo.jpg');
    await svc.generateIfMissing('/uploads/photo.jpg');

    expect(mockRepo.findOne).toHaveBeenCalledTimes(1);
  });

  it('prevents duplicate concurrent generation for the same URL', async () => {
    const { mockStrapi, mockRepo } = makeStrapi();
    mockRepo.findOne.mockResolvedValue({ id: 1, mime: 'image/jpeg', blurDataURL: null });
    mockRepo.update.mockResolvedValue({ id: 1 });
    mockReadFile.mockResolvedValue(JPEG_1x1);

    const svc = createBlurPlaceholderService({ strapi: mockStrapi });
    // Fire two concurrent calls — the second should be a no-op
    await Promise.all([
      svc.generateIfMissing('/uploads/photo.jpg'),
      svc.generateIfMissing('/uploads/photo.jpg'),
    ]);

    expect(mockRepo.findOne).toHaveBeenCalledTimes(1);
  });

  it('logs errors and does not throw on unexpected failures', async () => {
    const { mockStrapi, mockRepo } = makeStrapi();
    mockRepo.findOne.mockRejectedValue(new Error('DB connection lost'));
    const svc = createBlurPlaceholderService({ strapi: mockStrapi });
    await expect(svc.generateIfMissing('/uploads/photo.jpg')).resolves.toBeUndefined();
    expect(mockStrapi.log.error).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// invalidateUrl()
// ---------------------------------------------------------------------------

describe('blurPlaceholderService.invalidateUrl', () => {
  it('forces a DB re-check on the next generateIfMissing call', async () => {
    const { mockRepo, svc } = setupConfirmedBlur();

    await svc.generateIfMissing('/uploads/photo.jpg');
    expect(mockRepo.findOne).toHaveBeenCalledTimes(1);

    svc.invalidateUrl('/uploads/photo.jpg');

    mockRepo.findOne.mockResolvedValue({ id: 1, mime: 'image/jpeg', blurDataURL: 'data:...' });
    await svc.generateIfMissing('/uploads/photo.jpg');
    expect(mockRepo.findOne).toHaveBeenCalledTimes(2);
  });

  it('is a no-op for URLs that were never checked', async () => {
    const { mockStrapi } = makeStrapi();
    const svc = createBlurPlaceholderService({ strapi: mockStrapi });
    expect(() => svc.invalidateUrl('/uploads/never-seen.jpg')).not.toThrow();
  });
});
