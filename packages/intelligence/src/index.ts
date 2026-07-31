import { RecommendationService } from '@leadintel/shared';

export interface RecommendationContext {
  hasWebsite: boolean;
  websiteHealth: number | null;
  conversionReadiness: number | null;
  businessVitality: number | null;
  technicalSeo: number | null;
  performance: number | null;
  analyticsDetected: boolean;
  evidenceIds: Record<string, string[]>;
}

export interface RecommendationResult {
  service: RecommendationService | string;
  priority: number;
  reason: string;
  evidenceIds: string[];
  ruleId: string;
}

type Rule = {
  id: string;
  service: RecommendationService;
  priority: number;
  when: (ctx: RecommendationContext) => boolean;
  reason: (ctx: RecommendationContext) => string;
  evidenceKeys: string[];
};

const RULES: Rule[] = [
  {
    id: 'no-website-dev',
    service: RecommendationService.WEBSITE_DEVELOPMENT,
    priority: 1,
    when: (c) => !c.hasWebsite && (c.businessVitality ?? 0) > 55,
    reason: () => 'No website detected while business vitality is healthy',
    evidenceKeys: ['vitality', 'website'],
  },
  {
    id: 'redesign-low-health',
    service: RecommendationService.WEBSITE_REDESIGN,
    priority: 1,
    when: (c) => c.hasWebsite && (c.websiteHealth ?? 100) < 40,
    reason: (c) => `Website health is ${c.websiteHealth}`,
    evidenceKeys: ['websiteHealth'],
  },
  {
    id: 'performance-opt',
    service: RecommendationService.PERFORMANCE_OPTIMIZATION,
    priority: 1,
    when: (c) => (c.performance ?? 100) < 45 && (c.businessVitality ?? 0) > 60,
    reason: (c) => `Performance score ${c.performance} with vitality ${c.businessVitality}`,
    evidenceKeys: ['performance', 'vitality'],
  },
  {
    id: 'conversion-opt',
    service: RecommendationService.CONVERSION_OPTIMIZATION,
    priority: 2,
    when: (c) => (c.conversionReadiness ?? 100) < 45 && (c.businessVitality ?? 0) > 50,
    reason: (c) => `Conversion readiness is ${c.conversionReadiness}`,
    evidenceKeys: ['conversion'],
  },
  {
    id: 'local-seo',
    service: RecommendationService.LOCAL_SEO,
    priority: 2,
    when: (c) => (c.technicalSeo ?? 100) < 50 && c.hasWebsite,
    reason: (c) => `Technical SEO score is ${c.technicalSeo}`,
    evidenceKeys: ['seo'],
  },
  {
    id: 'analytics-setup',
    service: RecommendationService.ANALYTICS_SETUP,
    priority: 3,
    when: (c) => c.hasWebsite && !c.analyticsDetected,
    reason: () => 'Analytics tags not detected on the verified website',
    evidenceKeys: ['analytics'],
  },
];

export function generateRecommendations(ctx: RecommendationContext): RecommendationResult[] {
  const out: RecommendationResult[] = [];
  for (const rule of RULES) {
    if (!rule.when(ctx)) continue;
    const evidenceIds = rule.evidenceKeys.flatMap((k) => ctx.evidenceIds[k] ?? []);
    if (evidenceIds.length === 0 && rule.evidenceKeys.length > 0) {
      // Still require at least synthetic evidence ids from caller for factual rules
      continue;
    }
    out.push({
      service: rule.service,
      priority: rule.priority,
      reason: rule.reason(ctx),
      evidenceIds,
      ruleId: rule.id,
    });
  }
  return out.sort((a, b) => a.priority - b.priority);
}

export interface NarrativeStub {
  primaryProblem: string;
  businessImpact: string;
  recommendedService: string;
  secondaryService?: string;
  whyContact: string;
  openingPitch: string;
}

/** Deterministic Phase-1 narrative from recommendations (not AI evidence). */
export function buildRuleBasedNarrative(
  businessName: string,
  recommendations: RecommendationResult[],
): NarrativeStub {
  const primary = recommendations[0];
  const secondary = recommendations[1];
  const service = primary?.service ?? 'Website Maintenance';
  return {
    primaryProblem: primary?.reason ?? 'Digital presence gaps identified from website evidence',
    businessImpact:
      'Observed website and conversion gaps may reduce inbound enquiry capture; figures are not estimated without evidence.',
    recommendedService: String(service),
    secondaryService: secondary ? String(secondary.service) : undefined,
    whyContact: `${businessName} shows evidence-backed opportunity for ${service}.`,
    openingPitch: `We reviewed your public website signals and found a clear opportunity around ${service}. Happy to share the evidence-backed findings.`,
  };
}

export interface AIProvider {
  analyze(input: {
    businessName: string;
    evidenceSummary: Record<string, unknown>;
  }): Promise<NarrativeStub>;
}

export class DisabledAIProvider implements AIProvider {
  async analyze(): Promise<NarrativeStub> {
    throw new Error('AI analysis is disabled');
  }
}
