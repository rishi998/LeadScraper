import type { FindingSeverity, MetricDataSource } from '@leadintel/shared';

export interface AuditMetricResult {
  module: string;
  name: string;
  value?: number;
  valueText?: string;
  unit?: string;
  dataSource: MetricDataSource;
  confidence: number;
}

export interface AuditFindingResult {
  module: string;
  severity: FindingSeverity;
  code: string;
  message: string;
  evidence?: { field: string; value: string; sourceUrl?: string; method: string };
}

export interface ModuleAuditResult {
  module: string;
  score: number | null;
  confidence: number;
  metrics: AuditMetricResult[];
  findings: AuditFindingResult[];
}

export interface CrawlPageLike {
  url: string;
  finalUrl?: string | null;
  statusCode?: number | null;
  htmlSnippet?: string | null;
  title?: string | null;
  headers?: Record<string, string> | null;
}

export interface AuditInput {
  websiteUrl: string;
  pages: CrawlPageLike[];
  robotsAllowed?: boolean | null;
  hasSitemap?: boolean;
}
