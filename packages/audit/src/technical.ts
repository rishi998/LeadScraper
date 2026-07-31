import { FindingSeverity } from '@leadintel/shared';
import { f, m, pickHome } from './helpers.js';
import type { AuditInput, ModuleAuditResult } from './types.js';

export function runTechnicalAudit(input: AuditInput): ModuleAuditResult {
  const metrics = [];
  const findings = [];
  const home = pickHome(input.pages);
  const status = home?.statusCode ?? 0;
  metrics.push(m('TECHNICAL', 'statusCode', status));
  let score = 70;
  if (status >= 200 && status < 400) score = 85;
  else if (status === 0) {
    score = 20;
    findings.push(
      f('TECHNICAL', FindingSeverity.CRITICAL, 'UNREACHABLE', 'Home page could not be fetched', input.websiteUrl),
    );
  } else {
    score = 30;
    findings.push(f('TECHNICAL', FindingSeverity.CRITICAL, 'BAD_STATUS', `Home page status ${status}`, home?.url));
  }

  const broken = input.pages.filter((p) => (p.statusCode ?? 0) >= 400).length;
  metrics.push(m('TECHNICAL', 'brokenLinks', broken));
  if (broken > 0) {
    score = Math.max(0, score - broken * 5);
    findings.push(
      f('TECHNICAL', FindingSeverity.MAJOR, 'BROKEN_LINKS', `${broken} pages returned HTTP errors`, input.websiteUrl),
    );
  }

  metrics.push(m('TECHNICAL', 'pagesCrawled', input.pages.length));
  return { module: 'TECHNICAL', score, confidence: 0.8, metrics, findings };
}
