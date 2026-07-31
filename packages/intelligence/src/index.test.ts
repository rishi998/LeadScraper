import { describe, expect, it } from 'vitest';
import { generateRecommendations } from '../src/index.js';

describe('generateRecommendations', () => {
  it('requires evidence ids', () => {
    const without = generateRecommendations({
      hasWebsite: false,
      websiteHealth: null,
      conversionReadiness: null,
      businessVitality: 70,
      technicalSeo: null,
      performance: null,
      analyticsDetected: false,
      evidenceIds: {},
    });
    expect(without).toHaveLength(0);

    const withEvidence = generateRecommendations({
      hasWebsite: false,
      websiteHealth: null,
      conversionReadiness: null,
      businessVitality: 70,
      technicalSeo: null,
      performance: null,
      analyticsDetected: false,
      evidenceIds: { vitality: ['e1'], website: ['e2'] },
    });
    expect(withEvidence[0]?.ruleId).toBe('no-website-dev');
  });
});
