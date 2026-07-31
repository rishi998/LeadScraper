export type {
  AuditFindingResult,
  AuditInput,
  AuditMetricResult,
  CrawlPageLike,
  ModuleAuditResult,
} from './types.js';

export { runSeoAudit } from './seo.js';
export { runSecurityAudit } from './security.js';
export { runConversionAudit } from './conversion.js';
export { runTechnicalAudit } from './technical.js';
export { runAccessibilityAudit } from './accessibility.js';
export { runMobileUxAudit } from './mobile.js';
export {
  MockPerformanceProvider,
  LighthouseProvider,
  PageSpeedProvider,
  createPerformanceProvider,
  performanceReportToMetrics,
  type PerformanceProvider,
  type PerformanceReport,
} from './performance.js';

import { runSeoAudit } from './seo.js';
import { runSecurityAudit } from './security.js';
import { runConversionAudit } from './conversion.js';
import { runTechnicalAudit } from './technical.js';
import { runAccessibilityAudit } from './accessibility.js';
import { runMobileUxAudit } from './mobile.js';
import type { AuditInput, ModuleAuditResult } from './types.js';

/** Phase 2 full static audit suite (excludes performance provider). */
export function runFullAudits(input: AuditInput): ModuleAuditResult[] {
  return [
    runSeoAudit(input),
    runSecurityAudit(input),
    runConversionAudit(input),
    runTechnicalAudit(input),
    runAccessibilityAudit(input),
    runMobileUxAudit(input),
  ];
}

/** @deprecated Prefer runFullAudits — kept for compatibility. */
export function runBasicAudits(input: AuditInput): ModuleAuditResult[] {
  return runFullAudits(input);
}
