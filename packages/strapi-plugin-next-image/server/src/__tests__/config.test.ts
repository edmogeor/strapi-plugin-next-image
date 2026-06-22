import { describe, it, expect } from 'vitest';
import config from '../config';

const validate = config.validator;

describe('config.validator', () => {
  it('accepts the default config', () => {
    expect(() => validate(config.default)).not.toThrow();
  });

  it('accepts an empty config', () => {
    expect(() => validate({})).not.toThrow();
  });

  it('rejects non-array size/quality fields', () => {
    expect(() => validate({ deviceSizes: 640 })).toThrow(/deviceSizes/);
    expect(() => validate({ imageSizes: 64 })).toThrow(/imageSizes/);
    expect(() => validate({ qualities: 75 })).toThrow(/qualities/);
  });

  it('rejects non-number minimumCacheTTL and blurSize', () => {
    expect(() => validate({ minimumCacheTTL: '4h' })).toThrow(/minimumCacheTTL/);
    expect(() => validate({ blurSize: '8' })).toThrow(/blurSize/);
  });

  describe('remotePatterns', () => {
    it('accepts a valid array of patterns', () => {
      expect(() =>
        validate({ remotePatterns: [{ protocol: 'https', hostname: 'storage.googleapis.com' }] }),
      ).not.toThrow();
    });

    it('rejects a non-array', () => {
      expect(() => validate({ remotePatterns: { hostname: 'x.com' } })).toThrow(/must be an array/);
    });

    it('rejects an entry missing a string hostname', () => {
      expect(() => validate({ remotePatterns: [{ protocol: 'https' }] })).toThrow(/hostname/);
      expect(() => validate({ remotePatterns: [null] })).toThrow(/hostname/);
      expect(() => validate({ remotePatterns: [{ hostname: 123 }] })).toThrow(/hostname/);
    });
  });
});
