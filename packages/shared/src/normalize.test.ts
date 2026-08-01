import { describe, expect, it } from 'vitest';
import {
  normalizeBusinessName,
  normalizeEmail,
  normalizePhone,
  normalizeUrl,
  sanitizeExcelCell,
  similarityRatio,
} from '../src/normalize.js';

describe('normalizeBusinessName', () => {
  it('strips legal suffixes and punctuation', () => {
    expect(normalizeBusinessName('Smile Care Dental Pvt. Ltd.')).toBe('smile care dental');
  });
});

describe('normalizeEmail', () => {
  it('lowercases and validates', () => {
    expect(normalizeEmail('  Sales@Example.COM ')).toBe('sales@example.com');
    expect(normalizeEmail('not-an-email')).toBeNull();
  });

  it('strips mailto scheme, query params, and percent-encoding', () => {
    expect(normalizeEmail('mailto:info@shop.com')).toBe('info@shop.com');
    expect(normalizeEmail('mailto:info@shop.com?subject=Hello%20There')).toBe('info@shop.com');
    expect(normalizeEmail('mailto:info@shop.com?subject=Hi&body=Quote')).toBe('info@shop.com');
    expect(normalizeEmail('mailto:info%40shop.com')).toBe('info@shop.com');
    expect(normalizeEmail('mailto:a@shop.com,b@shop.com')).toBe('a@shop.com');
  });

  it('rejects asset paths that look like addresses', () => {
    expect(normalizeEmail('sprite@2x.png')).toBeNull();
    expect(normalizeEmail('icon@3x.svg')).toBeNull();
  });
});

describe('normalizePhone', () => {
  it('adds default country code for 10-digit numbers', () => {
    expect(normalizePhone('98765-43210')).toBe('+919876543210');
  });

  it('keeps e164', () => {
    expect(normalizePhone('+1 (415) 555-2671')).toBe('+14155552671');
  });
});

describe('normalizeUrl', () => {
  it('adds https and strips hash', () => {
    expect(normalizeUrl('example.com/path#x')).toBe('https://example.com/path');
  });
});

describe('sanitizeExcelCell', () => {
  it('prefixes formula-like strings', () => {
    expect(sanitizeExcelCell('=CMD()')).toBe("'=CMD()");
    expect(sanitizeExcelCell('+1234')).toBe("'+1234");
    expect(sanitizeExcelCell('-total')).toBe("'-total");
    expect(sanitizeExcelCell('@name')).toBe("'@name");
    expect(sanitizeExcelCell('safe')).toBe('safe');
  });
});

describe('similarityRatio', () => {
  it('scores near-duplicates high', () => {
    expect(similarityRatio('smile care dental', 'smile care dentl')).toBeGreaterThan(0.85);
  });
});
