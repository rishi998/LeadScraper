import { FRESHNESS_DAYS } from './constants.js';

export type FreshnessDomain = 'crawl' | 'performance' | 'technology' | 'contacts';

const DOMAIN_DAYS: Record<FreshnessDomain, number> = {
  crawl: FRESHNESS_DAYS.crawl,
  performance: FRESHNESS_DAYS.performanceAudit,
  technology: FRESHNESS_DAYS.technology,
  contacts: FRESHNESS_DAYS.contactVerification,
};

/** Days remaining until stale; negative means already stale. */
export function freshnessAgeDays(lastAt: Date | null | undefined, now = new Date()): number | null {
  if (!lastAt) return null;
  const ms = now.getTime() - lastAt.getTime();
  return ms / (24 * 60 * 60 * 1000);
}

export function isFresh(
  lastAt: Date | null | undefined,
  domain: FreshnessDomain,
  now = new Date(),
): boolean {
  const age = freshnessAgeDays(lastAt, now);
  if (age == null) return false;
  return age <= DOMAIN_DAYS[domain];
}

/** 0–1 freshness score for AuditConfidence (1 = just observed, 0 = fully stale or missing). */
export function freshnessScore(
  lastAt: Date | null | undefined,
  domain: FreshnessDomain,
  now = new Date(),
): number {
  const age = freshnessAgeDays(lastAt, now);
  if (age == null) return 0.2;
  const max = DOMAIN_DAYS[domain];
  if (age <= 0) return 1;
  if (age >= max * 2) return 0;
  if (age <= max) return 1 - (age / max) * 0.3;
  return Math.max(0, 0.7 - ((age - max) / max) * 0.7);
}

export function freshnessDaysFor(domain: FreshnessDomain): number {
  return DOMAIN_DAYS[domain];
}
