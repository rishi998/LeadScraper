import { FindingSeverity, MetricDataSource } from '@leadintel/shared';
import type { AuditFindingResult, AuditMetricResult, CrawlPageLike } from './types.js';

export function pickHome(pages: CrawlPageLike[]): CrawlPageLike | undefined {
  return (
    pages.find((p) => {
      try {
        const path = new URL(p.finalUrl ?? p.url).pathname;
        return path === '/' || path === '';
      } catch {
        return false;
      }
    }) ?? pages[0]
  );
}

export function m(
  module: string,
  name: string,
  value?: number,
  valueText?: string,
  dataSource: MetricDataSource = MetricDataSource.STATIC,
): AuditMetricResult {
  return {
    module,
    name,
    value,
    valueText,
    dataSource,
    confidence: 0.9,
  };
}

export function f(
  module: string,
  severity: FindingSeverity,
  code: string,
  message: string,
  sourceUrl?: string,
): AuditFindingResult {
  return {
    module,
    severity,
    code,
    message,
    evidence: sourceUrl
      ? { field: code.toLowerCase(), value: message, sourceUrl, method: 'STATIC_AUDIT' }
      : undefined,
  };
}
