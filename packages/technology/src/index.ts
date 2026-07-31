export interface TechnologyEvidence {
  name: string;
  category: string;
  confidence: number;
  signal: string;
  version?: string;
}

export interface TechnologyProvider {
  analyze(url: string, html?: string): Promise<TechnologyEvidence[]>;
  readonly id: string;
}

const FINGERPRINTS: Array<{ name: string; category: string; test: RegExp; confidence: number }> = [
  { name: 'WordPress', category: 'cms', test: /wp-content|wp-includes/i, confidence: 0.9 },
  { name: 'Shopify', category: 'cms', test: /cdn\.shopify\.com|Shopify\.theme/i, confidence: 0.9 },
  { name: 'Wix', category: 'cms', test: /static\.wixstatic\.com|wix\.com/i, confidence: 0.9 },
  { name: 'Webflow', category: 'cms', test: /webflow/i, confidence: 0.85 },
  { name: 'Squarespace', category: 'cms', test: /squarespace\.com|static\.squarespace/i, confidence: 0.9 },
  { name: 'Drupal', category: 'cms', test: /drupal\.settings|sites\/default\/files/i, confidence: 0.85 },
  { name: 'Next.js', category: 'framework', test: /__NEXT_DATA__|_next\/static/i, confidence: 0.9 },
  { name: 'Nuxt', category: 'framework', test: /__NUXT__|_nuxt\//i, confidence: 0.9 },
  { name: 'React', category: 'framework', test: /react(?:-dom)?(?:\.production|\.min)?\.js|data-reactroot/i, confidence: 0.7 },
  { name: 'Angular', category: 'framework', test: /ng-version|angular(?:\.min)?\.js/i, confidence: 0.8 },
  { name: 'Vue', category: 'framework', test: /vue(?:\.runtime)?(?:\.min)?\.js|data-v-/i, confidence: 0.7 },
  { name: 'jQuery', category: 'library', test: /jquery(?:\.min)?\.js/i, confidence: 0.85 },
  { name: 'Bootstrap', category: 'library', test: /bootstrap(?:\.min)?\.(?:js|css)/i, confidence: 0.85 },
  { name: 'Tailwind CSS', category: 'library', test: /tailwindcss|cdn\.tailwindcss/i, confidence: 0.75 },
  { name: 'Cloudflare', category: 'cdn', test: /cdnjs\.cloudflare|cloudflare\.com\/cdn|cf-ray/i, confidence: 0.8 },
  { name: 'Fastly', category: 'cdn', test: /fastly\.net|fastly-insights/i, confidence: 0.8 },
  { name: 'Google Analytics', category: 'analytics', test: /google-analytics\.com|gtag\/js|googletagmanager\.com\/gtag/i, confidence: 0.9 },
  { name: 'Google Tag Manager', category: 'tag-manager', test: /googletagmanager\.com\/gtm\.js/i, confidence: 0.95 },
  { name: 'Meta Pixel', category: 'analytics', test: /connect\.facebook\.net\/.+\/fbevents\.js|fbq\(/i, confidence: 0.9 },
  { name: 'Microsoft Clarity', category: 'analytics', test: /clarity\.ms|clarity\(/i, confidence: 0.9 },
  { name: 'Hotjar', category: 'analytics', test: /static\.hotjar\.com|hj\(/i, confidence: 0.9 },
  { name: 'HubSpot', category: 'marketing', test: /js\.hs-scripts\.com|hubspot/i, confidence: 0.85 },
  { name: 'LinkedIn Insight', category: 'analytics', test: /snap\.licdn\.com|linkedin\.com\/px|_linkedin_partner_id/i, confidence: 0.9 },
  { name: 'TikTok Pixel', category: 'analytics', test: /analytics\.tiktok\.com|ttq\.load/i, confidence: 0.9 },
];

export class LocalTechnologyDetector implements TechnologyProvider {
  readonly id = 'local';

  async analyze(_url: string, html = ''): Promise<TechnologyEvidence[]> {
    const found: TechnologyEvidence[] = [];
    for (const fp of FINGERPRINTS) {
      if (fp.test.test(html)) {
        found.push({
          name: fp.name,
          category: fp.category,
          confidence: fp.confidence,
          signal: fp.test.source,
          version: 'local@2',
        });
      }
    }
    return found;
  }
}

/** Optional adapter — disabled unless ENABLE_WAPPALYZER=true; remains a stub. */
export class WappalyzerProvider implements TechnologyProvider {
  readonly id = 'wappalyzer';

  async analyze(url: string): Promise<TechnologyEvidence[]> {
    if (process.env.ENABLE_WAPPALYZER !== 'true') {
      throw new Error('WappalyzerProvider disabled');
    }
    void url;
    return [];
  }
}

export function marketingDetectionSummary(tech: TechnologyEvidence[]): Record<string, string> {
  const names = new Set(tech.map((t) => t.name));
  const label = (name: string) => (names.has(name) ? 'detected' : 'not detected');
  return {
    analytics: label('Google Analytics'),
    gtm: label('Google Tag Manager'),
    metaPixel: label('Meta Pixel'),
    clarity: label('Microsoft Clarity'),
    hotjar: label('Hotjar'),
    hubspot: label('HubSpot'),
    linkedinInsight: label('LinkedIn Insight'),
    tiktokPixel: label('TikTok Pixel'),
  };
}

export function createTechnologyProvider(): TechnologyProvider {
  if (process.env.ENABLE_WAPPALYZER === 'true') return new WappalyzerProvider();
  return new LocalTechnologyDetector();
}
