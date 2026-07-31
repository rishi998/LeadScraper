export const SCORING_ALGORITHM_VERSION = 'scoring@1.0.0';

/** Pipeline stage identifiers (MongoDB job queue). */
export const PIPELINE_STAGES = [
  'DISCOVERY',
  'ENTITY_RESOLUTION',
  'WEBSITE_VERIFICATION',
  'CRAWL',
  'CONTACT_EXTRACTION',
  'AUDIT',
  'TECHNOLOGY',
  'SCORING',
  'ENRICHMENT',
  'AI_ANALYSIS',
  'EXPORT',
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

/** @deprecated Use PIPELINE_STAGES / ProcessingJobType. Kept for doc compatibility. */
export const QUEUE_NAMES = {
  DISCOVERY: 'DISCOVERY',
  ENTITY_RESOLUTION: 'ENTITY_RESOLUTION',
  WEBSITE_VERIFICATION: 'WEBSITE_VERIFICATION',
  CRAWL: 'CRAWL',
  CONTACT_EXTRACTION: 'CONTACT_EXTRACTION',
  AUDIT: 'AUDIT',
  TECHNOLOGY: 'TECHNOLOGY',
  SCORING: 'SCORING',
  ENRICHMENT: 'ENRICHMENT',
  AI_ANALYSIS: 'AI_ANALYSIS',
  EXPORT: 'EXPORT',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const WORKER_DEFAULTS = {
  concurrency: 5,
  pollIntervalMs: 1000,
  maxAttempts: 3,
  lockTimeoutMs: 300_000,
  staleRecoveryIntervalMs: 60_000,
  retryBackoffMs: [5_000, 30_000] as const,
  globalCrawlConcurrency: 5,
  perDomainConcurrency: 1,
  domainDelayMs: 250,
} as const;

export const FRESHNESS_DAYS = {
  crawl: 7,
  performanceAudit: 14,
  technology: 30,
  contactVerification: 30,
} as const;

export const CRAWLER_DEFAULTS = {
  maxPages: 15,
  timeoutMs: 15_000,
  maxContentBytes: 2_048_000,
  maxRedirects: 5,
  concurrency: 3,
  priorityPaths: [
    '/',
    '/contact',
    '/contact-us',
    '/about',
    '/about-us',
    '/services',
    '/locations',
    '/pricing',
  ],
} as const;

export const WEBSITE_HEALTH_WEIGHTS = {
  performance: 0.18,
  mobileUx: 0.15,
  seo: 0.15,
  security: 0.12,
  accessibility: 0.1,
  technical: 0.1,
  designUx: 0.1,
  conversion: 0.1,
} as const;

export const SALES_OPPORTUNITY_WEIGHTS = {
  websiteNeed: 0.25,
  conversionGap: 0.2,
  marketingGap: 0.15,
  businessVitality: 0.15,
  commercialPotential: 0.1,
  contactability: 0.1,
  evidenceConfidence: 0.05,
} as const;

export const PRIORITY_THRESHOLDS = {
  HOT: 80,
  WARM: 60,
  REVIEW: 40,
} as const;

export const PRIMARY_CONTACT_MIN_CONFIDENCE = 0.7;
export const AUTO_QUALIFY_WEBSITE_CONFIDENCE = 0.75;
