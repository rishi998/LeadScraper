import { describe, expect, it } from 'vitest';
import { LeadPriority, OperationalStatus, WebsiteVerificationStatus } from '@leadintel/shared';
import { scoreLead } from '../src/index.js';

describe('scoreLead', () => {
  it('does not treat missing dimensions as zero', () => {
    const result = scoreLead({
      dimensions: [
        { key: 'seo', score: 80, reliable: true },
        { key: 'security', score: 70, reliable: true },
        { key: 'conversion', score: 60, reliable: true },
        { key: 'technical', score: 75, reliable: true },
      ],
      conversionReadiness: 60,
      marketingGap: 50,
      contactConfidence: 80,
      websiteVerification: WebsiteVerificationStatus.VERIFIED,
      hasWebsite: true,
      operationalStatus: OperationalStatus.OPEN,
      crawlCoverage: 0.8,
      auditModulesComplete: 6,
      auditModulesExpected: 7,
      freshness: 0.95,
      primaryContactVerified: true,
    });
    expect(result.websiteHealth).toBeGreaterThan(65);
    expect(result.websiteHealth).toBeLessThan(85);
    expect(result.auditConfidence).toBeGreaterThan(70);
  });

  it('lowers audit confidence when freshness is poor', () => {
    const base = {
      dimensions: [{ key: 'seo' as const, score: 80, reliable: true }],
      conversionReadiness: 60,
      marketingGap: 50,
      contactConfidence: 80,
      websiteVerification: WebsiteVerificationStatus.VERIFIED,
      hasWebsite: true,
      operationalStatus: OperationalStatus.OPEN,
      crawlCoverage: 0.9,
      auditModulesComplete: 7,
      auditModulesExpected: 7,
      primaryContactVerified: true,
    };
    const fresh = scoreLead({ ...base, freshness: 1 });
    const stale = scoreLead({ ...base, freshness: 0 });
    expect(fresh.auditConfidence).toBeGreaterThan(stale.auditConfidence);
  });

  it('prevents closed businesses from becoming HOT', () => {
    const result = scoreLead({
      dimensions: [{ key: 'seo', score: 10, reliable: true }],
      conversionReadiness: 10,
      marketingGap: 90,
      contactConfidence: 80,
      hasWebsite: true,
      websiteBroken: true,
      websiteVerification: WebsiteVerificationStatus.LIKELY,
      operationalStatus: OperationalStatus.CLOSED,
      crawlCoverage: 0.5,
      auditModulesComplete: 4,
      auditModulesExpected: 4,
      primaryContactVerified: true,
    });
    expect(result.salesOpportunity).toBeLessThanOrEqual(25);
    expect(result.priority).not.toBe(LeadPriority.HOT);
  });
});
