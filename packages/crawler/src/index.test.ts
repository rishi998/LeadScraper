import { describe, expect, it } from 'vitest';
import { isPrivateIp, shouldUseBrowser, verifyWebsite } from '../src/index.js';

describe('isPrivateIp', () => {
  it('blocks private ranges', () => {
    expect(isPrivateIp('127.0.0.1')).toBe(true);
    expect(isPrivateIp('10.0.0.5')).toBe(true);
    expect(isPrivateIp('192.168.1.1')).toBe(true);
    expect(isPrivateIp('169.254.169.254')).toBe(true);
    expect(isPrivateIp('8.8.8.8')).toBe(false);
  });
});

describe('shouldUseBrowser', () => {
  it('detects SPA shells with little text', () => {
    const html = `<!doctype html><html><body><div id="root"></div><script src="/app.js"></script></body></html>`;
    expect(shouldUseBrowser(html, 200)).toBe(true);
  });

  it('skips content-rich static pages', () => {
    const html = `<!doctype html><html><body><h1>Clinic</h1><p>${'Welcome to our dental clinic. '.repeat(20)}</p></body></html>`;
    expect(shouldUseBrowser(html, 200)).toBe(false);
  });
});

describe('verifyWebsite', () => {
  it('scores matching name and phone highly', () => {
    const result = verifyWebsite({
      businessName: 'Smile Care Dental',
      websiteUrl: 'https://smile-care-dental.example.com',
      phone: '+919876543210',
      city: 'Faridabad',
      pageTitle: 'Smile Care Dental | Faridabad Dentist',
      pageText: 'Call us at +91 98765 43210. Best dentist in Faridabad.',
    });
    expect(['VERIFIED', 'LIKELY']).toContain(result.status);
    expect(result.confidence).toBeGreaterThanOrEqual(0.65);
  });
});
