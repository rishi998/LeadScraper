import { describe, expect, it } from 'vitest';
import { LocalTechnologyDetector, marketingDetectionSummary } from '../src/index.js';

describe('LocalTechnologyDetector', () => {
  it('detects wordpress and gtm fingerprints', async () => {
    const detector = new LocalTechnologyDetector();
    const tech = await detector.analyze('https://example.com', `
      <link href="/wp-content/themes/x/style.css" />
      <script src="https://www.googletagmanager.com/gtm.js"></script>
    `);
    expect(tech.map((t) => t.name)).toEqual(expect.arrayContaining(['WordPress', 'Google Tag Manager']));
    const marketing = marketingDetectionSummary(tech);
    expect(marketing.gtm).toBe('detected');
    expect(marketing.metaPixel).toBe('not detected');
    expect(marketing.hubspot).toBe('not detected');
  });

  it('detects CDN and HubSpot', async () => {
    const detector = new LocalTechnologyDetector();
    const tech = await detector.analyze('https://example.com', `
      <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js"></script>
      <script src="https://js.hs-scripts.com/123.js"></script>
    `);
    expect(tech.map((t) => t.name)).toEqual(expect.arrayContaining(['Cloudflare', 'HubSpot', 'jQuery']));
    expect(marketingDetectionSummary(tech).hubspot).toBe('detected');
  });
});
