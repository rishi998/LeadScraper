import { describe, expect, it } from 'vitest';
import { freshnessScore, isFresh } from './freshness.js';

describe('isFresh', () => {
  const now = new Date('2026-07-31T00:00:00Z');

  it('is false when missing', () => {
    expect(isFresh(null, 'crawl', now)).toBe(false);
  });

  it('is true within crawl window', () => {
    const last = new Date('2026-07-28T00:00:00Z');
    expect(isFresh(last, 'crawl', now)).toBe(true);
  });

  it('is false after crawl window', () => {
    const last = new Date('2026-07-20T00:00:00Z');
    expect(isFresh(last, 'crawl', now)).toBe(false);
  });

  it('uses 14 days for performance', () => {
    const last = new Date('2026-07-20T00:00:00Z');
    expect(isFresh(last, 'performance', now)).toBe(true);
    const older = new Date('2026-07-10T00:00:00Z');
    expect(isFresh(older, 'performance', now)).toBe(false);
  });
});

describe('freshnessScore', () => {
  const now = new Date('2026-07-31T00:00:00Z');

  it('returns high score for recent artifacts', () => {
    expect(freshnessScore(now, 'crawl', now)).toBe(1);
  });

  it('returns low score when missing', () => {
    expect(freshnessScore(null, 'technology', now)).toBe(0.2);
  });
});
