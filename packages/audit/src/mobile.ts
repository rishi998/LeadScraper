import * as cheerio from 'cheerio';
import { FindingSeverity } from '@leadintel/shared';
import { f, m, pickHome } from './helpers.js';
import type { AuditInput, ModuleAuditResult } from './types.js';

export function runMobileUxAudit(input: AuditInput): ModuleAuditResult {
  const home = pickHome(input.pages);
  const html = home?.htmlSnippet ?? '';
  const $ = cheerio.load(html);
  const metrics = [];
  const findings = [];
  let points = 0;
  let total = 0;

  const viewport = $('meta[name="viewport"]').attr('content') ?? '';
  const viewportOk = /width\s*=\s*device-width/i.test(viewport);
  total += 1;
  points += viewportOk ? 1 : 0;
  metrics.push(m('MOBILE_UX', 'viewportQuality', viewportOk ? 1 : 0, viewport || undefined));
  if (!viewportOk) {
    findings.push(
      f('MOBILE_UX', FindingSeverity.MAJOR, 'BAD_VIEWPORT', 'Viewport not configured for mobile devices', home?.url),
    );
  }

  const smallTap =
    $('a, button').filter((_, el) => {
      const style = $(el).attr('style') ?? '';
      return /font-size:\s*(?:[0-9]|1[0-1])px/i.test(style);
    }).length > 3;
  total += 1;
  points += smallTap ? 0.4 : 1;
  metrics.push(m('MOBILE_UX', 'tapTargetHeuristic', smallTap ? 0 : 1));

  const baseFont = /font-size:\s*(?:1[0-2]|[0-9])px/i.test($('body').attr('style') ?? '') ||
    /font-size:\s*(?:1[0-2]|[0-9])px/i.test($('html').attr('style') ?? '');
  total += 1;
  points += baseFont ? 0.5 : 1;
  metrics.push(m('MOBILE_UX', 'readableFontBase', baseFont ? 0 : 1));

  const overflowClue = /overflow-x:\s*scroll|min-width:\s*(?:[5-9]\d{2}|[1-9]\d{3,})px/i.test(html);
  total += 1;
  points += overflowClue ? 0.4 : 1;
  metrics.push(m('MOBILE_UX', 'horizontalOverflowRisk', overflowClue ? 1 : 0));
  if (overflowClue) {
    findings.push(
      f('MOBILE_UX', FindingSeverity.MINOR, 'OVERFLOW_RISK', 'Possible horizontal overflow / wide fixed layout', home?.url),
    );
  }

  const mobileCta =
    $('a[href^="tel:"], a[href*="wa.me"], a[href*="whatsapp"]').length > 0 ||
    /call now|whatsapp|book now/i.test(html);
  total += 1;
  points += mobileCta ? 1 : 0.4;
  metrics.push(m('MOBILE_UX', 'mobileCta', mobileCta ? 1 : 0));

  const score = total ? (points / total) * 100 : null;
  metrics.push(m('MOBILE_UX', 'mobileUxScore', score ?? undefined));
  return { module: 'MOBILE_UX', score, confidence: home ? 0.7 : 0.35, metrics, findings };
}
