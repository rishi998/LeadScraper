import * as cheerio from 'cheerio';
import { FindingSeverity } from '@leadintel/shared';
import { f, m, pickHome } from './helpers.js';
import type { AuditInput, ModuleAuditResult } from './types.js';

export function runAccessibilityAudit(input: AuditInput): ModuleAuditResult {
  const home = pickHome(input.pages);
  const html = home?.htmlSnippet ?? '';
  const $ = cheerio.load(html);
  const metrics = [];
  const findings = [];
  let points = 0;
  let total = 0;

  const lang = $('html').attr('lang')?.trim();
  total += 1;
  points += lang ? 1 : 0;
  metrics.push(m('ACCESSIBILITY', 'lang', lang ? 1 : 0, lang));
  if (!lang) {
    findings.push(f('ACCESSIBILITY', FindingSeverity.MAJOR, 'MISSING_LANG', 'html lang attribute missing', home?.url));
  }

  const landmarks =
    $('main, [role="main"], nav, [role="navigation"], header, footer').length > 0;
  total += 1;
  points += landmarks ? 1 : 0;
  metrics.push(m('ACCESSIBILITY', 'landmarks', landmarks ? 1 : 0));

  const images = $('img');
  let missingAlt = 0;
  images.each((_, el) => {
    if ($(el).attr('alt') === undefined) missingAlt += 1;
  });
  total += 1;
  const altOk = images.length === 0 || missingAlt / images.length <= 0.3;
  points += altOk ? 1 : 0.4;
  metrics.push(m('ACCESSIBILITY', 'imagesMissingAlt', missingAlt));
  if (missingAlt > 0) {
    findings.push(
      f(
        'ACCESSIBILITY',
        FindingSeverity.MINOR,
        'IMG_MISSING_ALT',
        `${missingAlt} images missing alt attributes`,
        home?.url,
      ),
    );
  }

  const inputs = $('input:not([type="hidden"]), select, textarea');
  let unlabeled = 0;
  inputs.each((_, el) => {
    const id = $(el).attr('id');
    const aria = $(el).attr('aria-label') || $(el).attr('aria-labelledby');
    const hasLabel = id ? $(`label[for="${id}"]`).length > 0 : false;
    const wrapped = $(el).closest('label').length > 0;
    if (!aria && !hasLabel && !wrapped) unlabeled += 1;
  });
  total += 1;
  points += unlabeled === 0 ? 1 : 0.3;
  metrics.push(m('ACCESSIBILITY', 'unlabeledInputs', unlabeled));

  const skip = $('a[href="#main"], a[href="#content"], .skip-link, [class*="skip"]').length > 0;
  total += 1;
  points += skip ? 1 : 0.5;
  metrics.push(m('ACCESSIBILITY', 'skipLink', skip ? 1 : 0));

  // Static contrast heuristic: light text on light bg class names / inline styles
  const suspiciousContrast =
    /color:\s*#(?:[fF]{3}|[eE]{3}|fff|eee)/.test(html) &&
    /background(?:-color)?:\s*#(?:[fF]{3}|fff|ffffff)/.test(html);
  total += 1;
  points += suspiciousContrast ? 0.3 : 1;
  metrics.push(m('ACCESSIBILITY', 'contrastHeuristic', suspiciousContrast ? 0 : 1));
  if (suspiciousContrast) {
    findings.push(
      f(
        'ACCESSIBILITY',
        FindingSeverity.INFO,
        'CONTRAST_HEURISTIC',
        'Possible low-contrast light-on-light styles detected',
        home?.url,
      ),
    );
  }

  const score = total ? (points / total) * 100 : null;
  metrics.push(m('ACCESSIBILITY', 'accessibilityScore', score ?? undefined));
  return { module: 'ACCESSIBILITY', score, confidence: home ? 0.75 : 0.35, metrics, findings };
}
