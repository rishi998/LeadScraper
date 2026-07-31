import * as cheerio from 'cheerio';
import { FindingSeverity } from '@leadintel/shared';
import { f, m, pickHome } from './helpers.js';
import type { AuditInput, ModuleAuditResult } from './types.js';

export function runSeoAudit(input: AuditInput): ModuleAuditResult {
  const home = pickHome(input.pages);
  const html = home?.htmlSnippet ?? '';
  const $ = cheerio.load(html);
  const metrics = [];
  const findings = [];
  let points = 0;
  let total = 0;

  const title = ($('title').text() || home?.title || '').trim();
  total += 1;
  if (title) {
    points += 1;
    metrics.push(m('SEO', 'titlePresent', 1));
  } else {
    findings.push(f('SEO', FindingSeverity.MAJOR, 'MISSING_TITLE', 'Document title is missing', home?.url));
    metrics.push(m('SEO', 'titlePresent', 0));
  }

  const desc = $('meta[name="description"]').attr('content')?.trim() ?? '';
  total += 1;
  if (desc) {
    points += 1;
    metrics.push(m('SEO', 'descriptionPresent', 1));
  } else {
    findings.push(
      f('SEO', FindingSeverity.MAJOR, 'MISSING_META_DESCRIPTION', 'Meta description is missing', home?.url),
    );
    metrics.push(m('SEO', 'descriptionPresent', 0));
  }

  const h1Count = $('h1').length;
  total += 1;
  if (h1Count === 1) {
    points += 1;
    metrics.push(m('SEO', 'h1Present', 1));
  } else {
    findings.push(
      f(
        'SEO',
        FindingSeverity.MINOR,
        'H1_ISSUE',
        h1Count === 0 ? 'No H1 found' : `Expected one H1, found ${h1Count}`,
        home?.url,
      ),
    );
    metrics.push(m('SEO', 'h1Present', h1Count > 0 ? 0.5 : 0));
  }

  const canonical = $('link[rel="canonical"]').attr('href');
  total += 1;
  if (canonical) {
    points += 1;
    metrics.push(m('SEO', 'canonical', 1, canonical));
  } else {
    metrics.push(m('SEO', 'canonical', 0));
    findings.push(f('SEO', FindingSeverity.MINOR, 'MISSING_CANONICAL', 'Canonical link not found', home?.url));
  }

  const viewport = $('meta[name="viewport"]').attr('content');
  total += 1;
  if (viewport) {
    points += 1;
    metrics.push(m('SEO', 'viewport', 1));
  } else {
    metrics.push(m('SEO', 'viewport', 0));
    findings.push(f('SEO', FindingSeverity.MAJOR, 'MISSING_VIEWPORT', 'Viewport meta tag missing', home?.url));
  }

  const ogTitle = $('meta[property="og:title"]').attr('content');
  const ogDesc = $('meta[property="og:description"]').attr('content');
  const twitterCard = $('meta[name="twitter:card"]').attr('content');
  total += 1;
  const social = Boolean(ogTitle || ogDesc || twitterCard);
  points += social ? 1 : 0;
  metrics.push(m('SEO', 'openGraph', social ? 1 : 0));
  if (!social) {
    findings.push(f('SEO', FindingSeverity.MINOR, 'MISSING_OG', 'Open Graph / Twitter cards not detected', home?.url));
  }

  const ldNodes = $('script[type="application/ld+json"]');
  const hasLd = ldNodes.length > 0;
  let ldTypes = 0;
  ldNodes.each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || '{}');
      const t = json['@type'];
      if (t) ldTypes += Array.isArray(t) ? t.length : 1;
    } catch {
      /* ignore */
    }
  });
  total += 1;
  points += hasLd ? 1 : 0;
  metrics.push(m('SEO', 'structuredData', hasLd ? 1 : 0));
  metrics.push(m('SEO', 'structuredDataTypes', ldTypes));

  const hreflang = $('link[rel="alternate"][hreflang]').length;
  metrics.push(m('SEO', 'hreflang', hreflang > 0 ? 1 : 0));

  const images = $('img');
  let withAlt = 0;
  images.each((_, el) => {
    if (($(el).attr('alt') ?? '').trim()) withAlt += 1;
  });
  const altCoverage = images.length ? withAlt / images.length : 1;
  total += 1;
  points += altCoverage >= 0.7 ? 1 : altCoverage * 0.7;
  metrics.push(m('SEO', 'imageAltCoverage', Math.round(altCoverage * 100)));

  const text = $('body').text().replace(/\s+/g, ' ').trim();
  const thin = text.length > 0 && text.length < 200;
  total += 1;
  points += thin ? 0 : 1;
  metrics.push(m('SEO', 'thinContent', thin ? 1 : 0));
  if (thin) {
    findings.push(f('SEO', FindingSeverity.MINOR, 'THIN_CONTENT', 'Home page text content appears thin', home?.url));
  }

  total += 1;
  points += input.hasSitemap ? 1 : 0;
  metrics.push(m('SEO', 'sitemap', input.hasSitemap ? 1 : 0));

  total += 1;
  points += input.robotsAllowed !== false ? 1 : 0;
  metrics.push(m('SEO', 'robots', input.robotsAllowed === false ? 0 : 1));

  const score = total ? (points / total) * 100 : null;
  const contentSEOScore = ((title ? 1 : 0) + (desc ? 1 : 0) + (h1Count === 1 ? 1 : 0) + (thin ? 0 : 1)) / 4 * 100;
  metrics.push(m('SEO', 'technicalSEOScore', score ?? undefined));
  metrics.push(m('SEO', 'contentSEOScore', contentSEOScore));
  metrics.push(m('SEO', 'localSEOReadiness', hasLd && title ? 75 : 40));

  return { module: 'SEO', score, confidence: home ? 0.85 : 0.4, metrics, findings };
}
