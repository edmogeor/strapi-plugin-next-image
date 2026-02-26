import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initializeStrapiImage, imageConfigDefault } from '../image-config';

// Store original defaults to reset after each test
const originalDefaults = { ...imageConfigDefault };

describe('initializeStrapiImage', () => {
    beforeEach(() => {
        // Reset defaults before each test
        Object.assign(imageConfigDefault, originalDefaults);
        vi.restoreAllMocks();
    });

    it('fetches config from the backend and updates defaults', async () => {
        // Mock successful fetch
        const mockConfig = {
            deviceSizes: [320, 640],
            imageSizes: [16, 32],
            qualities: [80],
            formats: ['image/avif'],
            dangerouslyAllowSVG: true,
        };

        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockConfig),
        });

        await initializeStrapiImage('https://cms.example.com');

        expect(global.fetch).toHaveBeenCalledWith('https://cms.example.com/api/next-image/config', expect.any(Object));
        expect(imageConfigDefault.deviceSizes).toEqual([320, 640]);
        expect(imageConfigDefault.imageSizes).toEqual([16, 32]);
        expect(imageConfigDefault.qualities).toEqual([80]);
        expect(imageConfigDefault.formats).toEqual(['image/avif']);
        expect(imageConfigDefault.dangerouslyAllowSVG).toBe(true);
    });

    it('handles partial backend config by merging with local defaults', async () => {
        // Mock fetch returning only deviceSizes
        const mockConfig = {
            deviceSizes: [100, 200],
        };

        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockConfig),
        });

        await initializeStrapiImage('https://backend.test');

        expect(imageConfigDefault.deviceSizes).toEqual([100, 200]);
        // Other values should remain at original Next.js defaults
        expect(imageConfigDefault.imageSizes).toEqual(originalDefaults.imageSizes);
        expect(imageConfigDefault.formats).toEqual(originalDefaults.formats);
    });

    it('gracefully handles non-ok response without throwing or mutating defaults', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 404,
        });

        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

        await initializeStrapiImage('https://backend.test');

        expect(consoleSpy).toHaveBeenCalled();
        expect(imageConfigDefault).toEqual(originalDefaults); // Should remain untouched
    });

    it('gracefully handles network errors without throwing or mutating defaults', async () => {
        global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        await initializeStrapiImage('https://backend.test');

        expect(consoleSpy).toHaveBeenCalled();
        expect(imageConfigDefault).toEqual(originalDefaults); // Should remain untouched
    });
});
