import { describe, it, expect, beforeEach } from 'vitest';
import { imageConfigDefault, configure, getImageConfig } from '../image-config';

describe('configure / getImageConfig', () => {
  beforeEach(() => {
    // Reset to defaults before each test
    configure({});
  });

  it('returns defaults when configure has not been called', () => {
    configure({}); // reset
    expect(getImageConfig()).toEqual(imageConfigDefault);
  });

  it('merges partial overrides with defaults', () => {
    configure({ deviceSizes: [640, 1080, 1920], qualities: [80] });

    const config = getImageConfig();
    expect(config.deviceSizes).toEqual([640, 1080, 1920]);
    expect(config.qualities).toEqual([80]);
  });

  it('retains default values for fields not overridden', () => {
    configure({ dangerouslyAllowSVG: true });

    const config = getImageConfig();
    expect(config.deviceSizes).toEqual(imageConfigDefault.deviceSizes);
    expect(config.imageSizes).toEqual(imageConfigDefault.imageSizes);
    expect(config.qualities).toEqual(imageConfigDefault.qualities);
    expect(config.formats).toEqual(imageConfigDefault.formats);
    expect(config.unoptimized).toBe(imageConfigDefault.unoptimized);
    expect(config.dangerouslyAllowSVG).toBe(true);
  });

  it('replaces previous overrides on subsequent calls', () => {
    configure({ qualities: [90] });
    expect(getImageConfig().qualities).toEqual([90]);

    configure({ qualities: [50] });
    expect(getImageConfig().qualities).toEqual([50]);
  });

  it('resets overridden fields back to defaults when called without them', () => {
    configure({ qualities: [90] });
    configure({ deviceSizes: [320] });

    const config = getImageConfig();
    expect(config.qualities).toEqual(imageConfigDefault.qualities);
    expect(config.deviceSizes).toEqual([320]);
  });
});
