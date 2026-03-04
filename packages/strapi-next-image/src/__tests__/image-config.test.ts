import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initializeStrapiImage, imageConfigDefault } from '../image-config';

// Store original defaults to reset after each test
const originalDefaults = { ...imageConfigDefault };

describe('initializeStrapiImage', () => {
    beforeEach(() => {
        // Reset defaults before each test
        Object.assign(imageConfigDefault, originalDefaults);
        vi.restoreAllMocks();
        // Use fake timers so we can flush the client-side setTimeout(0) deferral
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
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
        await vi.runAllTimersAsync(); // flush client-side setTimeout(0) deferral

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
        await vi.runAllTimersAsync();

        expect(imageConfigDefault.deviceSizes).toEqual([100, 200]);
        // Other values should remain at original Next.js defaults
        expect(imageConfigDefault.imageSizes).toEqual(originalDefaults.imageSizes);
        expect(imageConfigDefault.formats).toEqual(originalDefaults.formats);
    });

    it('sets path immediately even when config fetch returns non-ok', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 404,
        });

        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

        await initializeStrapiImage('https://backend.test');
        await vi.runAllTimersAsync();

        expect(consoleSpy).toHaveBeenCalled();
        // path is set synchronously before the fetch, so images always point to Strapi
        expect(imageConfigDefault.path).toBe('https://backend.test');
        // breakpoint config remains at defaults since fetch failed
        expect(imageConfigDefault.deviceSizes).toEqual(originalDefaults.deviceSizes);
        expect(imageConfigDefault.formats).toEqual(originalDefaults.formats);
    });

    it('sets path immediately even when network errors occur', async () => {
        global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        await initializeStrapiImage('https://backend.test');
        await vi.runAllTimersAsync();

        expect(consoleSpy).toHaveBeenCalled();
        // path is set synchronously before the fetch, so images always point to Strapi
        expect(imageConfigDefault.path).toBe('https://backend.test');
        // breakpoint config remains at defaults since fetch failed
        expect(imageConfigDefault.deviceSizes).toEqual(originalDefaults.deviceSizes);
        expect(imageConfigDefault.formats).toEqual(originalDefaults.formats);
    });

    it('sets path synchronously — works even without await', () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({}),
        });

        // Intentionally NOT awaiting — simulates fire-and-forget usage
        initializeStrapiImage('https://cms.example.com');

        // path must be set before the first render, even without await
        expect(imageConfigDefault.path).toBe('https://cms.example.com');
    });
});
