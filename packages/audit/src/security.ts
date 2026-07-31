import { FindingSeverity } from '@leadintel/shared';
import { f, m, pickHome } from './helpers.js';
import type { AuditInput, ModuleAuditResult } from './types.js';

export function runSecurityAudit(input: AuditInput): ModuleAuditResult {
  const home = pickHome(input.pages);
  const headers = home?.headers ?? {};
  const finalUrl = home?.finalUrl ?? home?.url ?? input.websiteUrl;
  const metrics = [];
  const findings = [];
  let points = 0;
  let total = 0;

  const https = finalUrl.startsWith('https://');
  total += 1;
  points += https ? 1 : 0;
  metrics.push(m('SECURITY', 'https', https ? 1 : 0));
  if (!https) {
    findings.push(f('SECURITY', FindingSeverity.CRITICAL, 'NO_HTTPS', 'Site is not served over HTTPS', finalUrl));
  }

  total += 1;
  const hsts = Boolean(headers['strict-transport-security']);
  points += hsts ? 1 : 0;
  metrics.push(m('SECURITY', 'hsts', hsts ? 1 : 0));

  total += 1;
  const csp = Boolean(headers['content-security-policy']);
  points += csp ? 1 : 0;
  metrics.push(m('SECURITY', 'csp', csp ? 1 : 0));

  total += 1;
  const xcto = Boolean(headers['x-content-type-options']);
  points += xcto ? 1 : 0;
  metrics.push(m('SECURITY', 'xContentTypeOptions', xcto ? 1 : 0));

  total += 1;
  const referrer = Boolean(headers['referrer-policy']);
  points += referrer ? 1 : 0;
  metrics.push(m('SECURITY', 'referrerPolicy', referrer ? 1 : 0));

  total += 1;
  const permissions = Boolean(headers['permissions-policy'] || headers['feature-policy']);
  points += permissions ? 1 : 0;
  metrics.push(m('SECURITY', 'permissionsPolicy', permissions ? 1 : 0));

  const server = headers['server'];
  if (server) {
    findings.push(f('SECURITY', FindingSeverity.INFO, 'SERVER_HEADER', `Server header disclosed: ${server}`, finalUrl));
  }

  const setCookie = headers['set-cookie'] ?? '';
  const cookieSecure = !setCookie || /;\s*secure/i.test(setCookie);
  const cookieHttpOnly = !setCookie || /;\s*httponly/i.test(setCookie);
  if (setCookie) {
    total += 2;
    points += cookieSecure ? 1 : 0;
    points += cookieHttpOnly ? 1 : 0;
    metrics.push(m('SECURITY', 'cookieSecure', cookieSecure ? 1 : 0));
    metrics.push(m('SECURITY', 'cookieHttpOnly', cookieHttpOnly ? 1 : 0));
    if (!cookieSecure) {
      findings.push(f('SECURITY', FindingSeverity.MAJOR, 'COOKIE_NOT_SECURE', 'Set-Cookie missing Secure flag', finalUrl));
    }
  }

  const html = home?.htmlSnippet ?? '';
  const mixed = https && /(?:src|href)=["']http:\/\//i.test(html);
  total += 1;
  points += mixed ? 0 : 1;
  metrics.push(m('SECURITY', 'mixedContent', mixed ? 0 : 1));
  if (mixed) {
    findings.push(
      f('SECURITY', FindingSeverity.MAJOR, 'MIXED_CONTENT', 'HTTP assets referenced on HTTPS page', finalUrl),
    );
  }

  metrics.push(m('SECURITY', 'tlsValid', https ? 1 : 0));

  return {
    module: 'SECURITY',
    score: total ? (points / total) * 100 : null,
    confidence: 0.8,
    metrics,
    findings,
  };
}
