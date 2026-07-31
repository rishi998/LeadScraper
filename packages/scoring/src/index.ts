import {
  DataQualityGrade,
  LeadPriority,
  OperationalStatus,
  PRIORITY_THRESHOLDS,
  SALES_OPPORTUNITY_WEIGHTS,
  SCORING_ALGORITHM_VERSION,
  ScoreModifier,
  WEBSITE_HEALTH_WEIGHTS,
  WebsiteVerificationStatus,
  clampScore,
} from '@leadintel/shared';

export interface DimensionScore {
  key: keyof typeof WEBSITE_HEALTH_WEIGHTS;
  score: number;
  reliable: boolean;
}

export interface ScoringInput {
  dimensions: DimensionScore[];
  conversionReadiness: number | null;
  marketingGap: number | null;
  commercialPotential?: number;
  contactConfidence: number | null;
  websiteVerification?: WebsiteVerificationStatus | null;
  hasWebsite: boolean;
  websiteBroken?: boolean;
  operationalStatus: OperationalStatus;
  crawlCoverage?: number;
  auditModulesComplete?: number;
  auditModulesExpected?: number;
  primaryContactVerified?: boolean;
  sourceQuality?: number;
  /** 0–1 freshness factor for AuditConfidence (from FreshnessPolicy). */
  freshness?: number;
}

export interface ScoringResult {
  algorithmVersion: string;
  websiteHealth: number | null;
  marketReadiness: number | null;
  conversionReadiness: number | null;
  businessVitality: number | null;
  contactConfidence: number | null;
  salesOpportunity: number;
  auditConfidence: number;
  priority: LeadPriority;
  dataQualityGrade: DataQualityGrade;
  modifiers: ScoreModifier[];
  components: Record<string, number | null>;
}

export function renormalizeWeightedScore(
  dims: Array<{ weight: number; score: number; reliable: boolean }>,
): number | null {
  const available = dims.filter((d) => d.reliable);
  if (available.length === 0) return null;
  const weightSum = available.reduce((s, d) => s + d.weight, 0);
  if (weightSum <= 0) return null;
  return available.reduce((s, d) => s + d.score * (d.weight / weightSum), 0);
}

export function computeWebsiteHealth(dimensions: DimensionScore[]): number | null {
  return renormalizeWeightedScore(
    dimensions.map((d) => ({
      weight: WEBSITE_HEALTH_WEIGHTS[d.key],
      score: d.score,
      reliable: d.reliable,
    })),
  );
}

export function computeBusinessVitality(input: ScoringInput): number {
  if (input.operationalStatus === OperationalStatus.CLOSED) return 15;
  if (input.operationalStatus === OperationalStatus.TEMPORARILY_CLOSED) return 25;

  let score = 50; // baseline for sparse data
  if (input.operationalStatus === OperationalStatus.OPEN) score += 15;
  if (input.contactConfidence != null && input.contactConfidence >= 70) score += 10;
  if (input.hasWebsite && !input.websiteBroken) score += 5;
  if (
    input.websiteVerification === WebsiteVerificationStatus.VERIFIED ||
    input.websiteVerification === WebsiteVerificationStatus.LIKELY
  ) {
    score += 5;
  }
  if (input.websiteBroken) score -= 10;
  if (!input.hasWebsite) score -= 5;
  return clampScore(score);
}

export function computeAuditConfidence(input: ScoringInput): number {
  const coverage = input.crawlCoverage ?? 0.5;
  const sourceQuality = input.sourceQuality ?? 0.7;
  const verification =
    input.websiteVerification === WebsiteVerificationStatus.VERIFIED
      ? 1
      : input.websiteVerification === WebsiteVerificationStatus.LIKELY
        ? 0.8
        : input.websiteVerification === WebsiteVerificationStatus.UNCERTAIN
          ? 0.4
          : input.hasWebsite
            ? 0.3
            : 0.2;
  const contact = (input.contactConfidence ?? 0) / 100;
  const expected = input.auditModulesExpected ?? 6;
  const complete = input.auditModulesComplete ?? 0;
  const completeness = Math.min(1, complete / Math.max(1, expected));
  const freshness = Math.max(0, Math.min(1, input.freshness ?? 0.5));

  return clampScore(
    (coverage * 0.2 +
      sourceQuality * 0.15 +
      verification * 0.2 +
      contact * 0.15 +
      completeness * 0.2 +
      freshness * 0.1) *
      100,
  );
}

export function computeSalesOpportunity(input: ScoringInput, scores: {
  websiteHealth: number | null;
  conversionReadiness: number | null;
  businessVitality: number;
  contactConfidence: number | null;
  auditConfidence: number;
  marketingGap: number;
}): { opportunity: number; modifiers: ScoreModifier[]; components: Record<string, number> } {
  const modifiers: ScoreModifier[] = [];
  const websiteNeed = !input.hasWebsite
    ? 90
    : input.websiteBroken
      ? 95
      : scores.websiteHealth == null
        ? 60
        : 100 - scores.websiteHealth;
  const conversionGap = scores.conversionReadiness == null ? 50 : 100 - scores.conversionReadiness;

  if (!input.hasWebsite) modifiers.push(ScoreModifier.NO_WEBSITE);
  if (input.websiteBroken) modifiers.push(ScoreModifier.BROKEN_WEBSITE);
  if (scores.businessVitality >= 75) modifiers.push(ScoreModifier.HIGH_BUSINESS_VITALITY);
  if ((scores.contactConfidence ?? 0) < 50) modifiers.push(ScoreModifier.NO_RELIABLE_CONTACT);
  if (scores.auditConfidence < 50) modifiers.push(ScoreModifier.LOW_AUDIT_CONFIDENCE);
  if (
    input.operationalStatus === OperationalStatus.CLOSED ||
    input.operationalStatus === OperationalStatus.TEMPORARILY_CLOSED
  ) {
    modifiers.push(ScoreModifier.CLOSED_BUSINESS);
  }

  const commercialPotential = input.commercialPotential ?? 50;
  const components = {
    websiteNeed,
    conversionGap,
    marketingGap: scores.marketingGap,
    businessVitality: scores.businessVitality,
    commercialPotential,
    contactability: scores.contactConfidence ?? 40,
    evidenceConfidence: scores.auditConfidence,
  };

  let opportunity =
    components.websiteNeed * SALES_OPPORTUNITY_WEIGHTS.websiteNeed +
    components.conversionGap * SALES_OPPORTUNITY_WEIGHTS.conversionGap +
    components.marketingGap * SALES_OPPORTUNITY_WEIGHTS.marketingGap +
    components.businessVitality * SALES_OPPORTUNITY_WEIGHTS.businessVitality +
    components.commercialPotential * SALES_OPPORTUNITY_WEIGHTS.commercialPotential +
    components.contactability * SALES_OPPORTUNITY_WEIGHTS.contactability +
    components.evidenceConfidence * SALES_OPPORTUNITY_WEIGHTS.evidenceConfidence;

  if (modifiers.includes(ScoreModifier.HIGH_BUSINESS_VITALITY)) opportunity += 5;
  if (modifiers.includes(ScoreModifier.NO_RELIABLE_CONTACT)) opportunity -= 20;
  if (modifiers.includes(ScoreModifier.LOW_AUDIT_CONFIDENCE)) opportunity -= 10;
  if (modifiers.includes(ScoreModifier.CLOSED_BUSINESS)) opportunity = Math.min(opportunity, 25);

  return { opportunity: clampScore(opportunity), modifiers, components };
}

export function priorityFromOpportunity(
  opportunity: number,
  modifiers: ScoreModifier[],
): LeadPriority {
  if (modifiers.includes(ScoreModifier.CLOSED_BUSINESS)) {
    return opportunity >= PRIORITY_THRESHOLDS.REVIEW ? LeadPriority.REVIEW : LeadPriority.LOW;
  }
  if (opportunity >= PRIORITY_THRESHOLDS.HOT) return LeadPriority.HOT;
  if (opportunity >= PRIORITY_THRESHOLDS.WARM) return LeadPriority.WARM;
  if (opportunity >= PRIORITY_THRESHOLDS.REVIEW) return LeadPriority.REVIEW;
  return LeadPriority.LOW;
}

export function computeDataQualityGrade(input: ScoringInput, auditConfidence: number): DataQualityGrade {
  const verifiedSite =
    input.websiteVerification === WebsiteVerificationStatus.VERIFIED ||
    input.websiteVerification === WebsiteVerificationStatus.LIKELY;
  const contactOk = Boolean(input.primaryContactVerified) || (input.contactConfidence ?? 0) >= 70;
  const auditComplete = (input.auditModulesComplete ?? 0) >= (input.auditModulesExpected ?? 4) * 0.75;

  if (
    input.websiteVerification === WebsiteVerificationStatus.VERIFIED &&
    contactOk &&
    auditComplete &&
    auditConfidence >= 85
  ) {
    return DataQualityGrade.A;
  }
  if (verifiedSite && contactOk && auditComplete && auditConfidence >= 70) return DataQualityGrade.B;
  if (auditConfidence >= 50) return DataQualityGrade.C;
  return DataQualityGrade.D;
}

export function scoreLead(input: ScoringInput): ScoringResult {
  const websiteHealthRaw = input.hasWebsite ? computeWebsiteHealth(input.dimensions) : null;
  const websiteHealth = websiteHealthRaw == null ? null : clampScore(websiteHealthRaw);
  const conversionReadiness =
    input.conversionReadiness == null ? null : clampScore(input.conversionReadiness);
  const businessVitality = computeBusinessVitality(input);
  const contactConfidence =
    input.contactConfidence == null ? null : clampScore(input.contactConfidence);
  const auditConfidence = computeAuditConfidence(input);
  const marketingGap = input.marketingGap ?? 60;
  const marketReadiness = clampScore(
    ((websiteHealth ?? 40) * 0.4 + (conversionReadiness ?? 40) * 0.3 + (100 - marketingGap) * 0.3),
  );

  const { opportunity, modifiers, components } = computeSalesOpportunity(input, {
    websiteHealth,
    conversionReadiness,
    businessVitality,
    contactConfidence,
    auditConfidence,
    marketingGap,
  });

  const priority = priorityFromOpportunity(opportunity, modifiers);
  const dataQualityGrade = computeDataQualityGrade(input, auditConfidence);

  return {
    algorithmVersion: SCORING_ALGORITHM_VERSION,
    websiteHealth,
    marketReadiness,
    conversionReadiness,
    businessVitality,
    contactConfidence,
    salesOpportunity: opportunity,
    auditConfidence,
    priority,
    dataQualityGrade,
    modifiers,
    components,
  };
}
