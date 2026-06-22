import { describe, it, expect } from 'vitest';
import { hasRemoteMatch, matchRemotePattern } from '../remote-pattern';

const u = (s: string) => new URL(s);

describe('matchRemotePattern', () => {
  it('matches on hostname only', () => {
    expect(matchRemotePattern({ hostname: 'example.com' }, u('https://example.com/a.jpg'))).toBe(
      true,
    );
    expect(matchRemotePattern({ hostname: 'example.com' }, u('https://other.com/a.jpg'))).toBe(
      false,
    );
  });

  it('enforces protocol when set', () => {
    const p = { protocol: 'https' as const, hostname: 'example.com' };
    expect(matchRemotePattern(p, u('https://example.com/a.jpg'))).toBe(true);
    expect(matchRemotePattern(p, u('http://example.com/a.jpg'))).toBe(false);
  });

  it('enforces port when set', () => {
    const p = { hostname: 'example.com', port: '8080' };
    expect(matchRemotePattern(p, u('https://example.com:8080/a.jpg'))).toBe(true);
    expect(matchRemotePattern(p, u('https://example.com/a.jpg'))).toBe(false);
  });

  it('supports wildcard subdomains', () => {
    expect(
      matchRemotePattern({ hostname: '**.example.com' }, u('https://a.b.example.com/x.jpg')),
    ).toBe(true);
    expect(matchRemotePattern({ hostname: '**.example.com' }, u('https://example.com/x.jpg'))).toBe(
      false,
    );
  });

  it('restricts pathname when set', () => {
    const p = { hostname: 'example.com', pathname: '/uploads/**' };
    expect(matchRemotePattern(p, u('https://example.com/uploads/a/b.jpg'))).toBe(true);
    expect(matchRemotePattern(p, u('https://example.com/private/b.jpg'))).toBe(false);
  });

  it('throws when hostname is missing', () => {
    // @ts-expect-error intentionally invalid pattern
    expect(() => matchRemotePattern({}, u('https://example.com/a.jpg'))).toThrow(/hostname/);
  });
});

describe('hasRemoteMatch', () => {
  it('is false for an empty allow-list (default: no remote images)', () => {
    expect(hasRemoteMatch([], u('https://example.com/a.jpg'))).toBe(false);
  });

  it('is true if any pattern matches', () => {
    const patterns = [{ hostname: 'cdn.a.com' }, { hostname: 'storage.googleapis.com' }];
    expect(hasRemoteMatch(patterns, u('https://storage.googleapis.com/b/x.jpg'))).toBe(true);
  });
});
