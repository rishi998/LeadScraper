import { describe, expect, it } from 'vitest';
import {
  MockPerformanceProvider,
  runAccessibilityAudit,
  runFullAudits,
  runMobileUxAudit,
} from '../src/index.js';

const sampleHtml = `<!doctype html><html lang="en"><head>
  <title>Smile Care Dental Faridabad</title>
  <meta name="description" content="Dentist in Faridabad" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta property="og:title" content="Smile Care" />
  <link rel="canonical" href="https://smile.example.com/" />
  <script type="application/ld+json">{"@type":"Dentist"}</script>
</head><body>
  <main>
    <h1>Smile Care Dental</h1>
    <img src="/a.jpg" alt="Clinic" />
    <a href="tel:+919876543210">Call Now</a>
    <form action="/contact"><label for="email">Email</label><input id="email" name="email" /></form>
  </main>
</body></html>`;

describe('runFullAudits', () => {
  it('includes a11y and mobile modules with solid scores', () => {
    const results = runFullAudits({
      websiteUrl: 'https://smile.example.com/',
      hasSitemap: true,
      robotsAllowed: true,
      pages: [
        {
          url: 'https://smile.example.com/',
          finalUrl: 'https://smile.example.com/',
          statusCode: 200,
          htmlSnippet: sampleHtml,
          title: 'Smile Care Dental Faridabad',
          headers: {
            'strict-transport-security': 'max-age=31536000',
            'x-content-type-options': 'nosniff',
            'referrer-policy': 'no-referrer',
            'content-security-policy': "default-src 'self'",
            'permissions-policy': 'geolocation=()',
          },
        },
      ],
    });

    expect(results.map((r) => r.module)).toEqual(
      expect.arrayContaining(['SEO', 'SECURITY', 'CONVERSION', 'TECHNICAL', 'ACCESSIBILITY', 'MOBILE_UX']),
    );
    expect(results.find((r) => r.module === 'SEO')?.score).toBeGreaterThan(70);
    expect(results.find((r) => r.module === 'ACCESSIBILITY')?.score).toBeGreaterThan(50);
    expect(results.find((r) => r.module === 'MOBILE_UX')?.score).toBeGreaterThan(50);
  });
});

describe('accessibility / mobile', () => {
  it('flags missing lang', () => {
    const result = runAccessibilityAudit({
      websiteUrl: 'https://x.example.com',
      pages: [{ url: 'https://x.example.com/', htmlSnippet: '<html><body><img></body></html>' }],
    });
    expect(result.findings.some((f) => f.code === 'MISSING_LANG')).toBe(true);
  });

  it('flags bad viewport', () => {
    const result = runMobileUxAudit({
      websiteUrl: 'https://x.example.com',
      pages: [{ url: 'https://x.example.com/', htmlSnippet: '<html><body>Hi</body></html>' }],
    });
    expect(result.findings.some((f) => f.code === 'BAD_VIEWPORT')).toBe(true);
  });
});

describe('MockPerformanceProvider', () => {
  it('returns deterministic lab metrics', async () => {
    const provider = new MockPerformanceProvider();
    const a = await provider.measure('https://a.example.com');
    const b = await provider.measure('https://a.example.com');
    expect(a.performanceScore).toBe(b.performanceScore);
    expect(a.dataSource).toBe('LAB');
    expect(a.notes).toMatch(/not field/i);
  });
});
