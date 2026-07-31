import * as cheerio from 'cheerio';
import { createHash } from 'node:crypto';
import { CRAWLER_DEFAULTS, extractDomain } from '@leadintel/shared';
import { safeFetch, type CrawlerOptions, type FetchResult } from './ssrf.js';
import {
  crawlWithPlaywright,
  playwrightEnabled,
  shouldUseBrowser,
} from './browser.js';
import type { CrawlPageResult, CrawlResult } from './types.js';

export type { CrawlPageResult, CrawlResult } from './types.js';
export {
  crawlWithPlaywright,
  playwrightEnabled,
  shouldUseBrowser,
} from './browser.js';
export { loadCrawlerOptionsFromEnv } from './options.js';

export interface WebsiteVerificationInput {
  businessName: string;
  websiteUrl: string;
  phone?: string | null;
  city?: string | null;
  pageTitle?: string | null;
  pageText?: string | null;
}

export interface WebsiteVerificationResult {
  status: 'VERIFIED' | 'LIKELY' | 'UNCERTAIN' | 'INVALID';
  confidence: number;
  reasons: string[];
}

function priorityScore(pathname: string): number {
  const p = pathname.toLowerCase().replace(/\/$/, '') || '/';
  const idx = CRAWLER_DEFAULTS.priorityPaths.findIndex((x) => x === p || p.endsWith(x));
  return idx === -1 ? 100 : idx;
}

export function discoverLinks(html: string, baseUrl: string, domain: string): string[] {
  const $ = cheerio.load(html);
  const links = new Set<string>();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return;
    try {
      const abs = new URL(href, baseUrl);
      if (abs.protocol !== 'http:' && abs.protocol !== 'https:') return;
      const d = extractDomain(abs.href);
      if (d !== domain) return;
      abs.hash = '';
      links.add(abs.href);
    } catch {
      /* ignore */
    }
  });
  return [...links];
}

export async function crawlWebsite(
  startUrl: string,
  options: CrawlerOptions & {
    maxPages?: number;
    executablePath?: string;
    enablePlaywright?: boolean;
  } = {},
): Promise<CrawlResult> {
  const domain = extractDomain(startUrl);
  if (!domain) throw new Error(`Cannot extract domain from ${startUrl}`);

  const maxPages = options.maxPages ?? CRAWLER_DEFAULTS.maxPages;
  const visited = new Set<string>();
  const queue: string[] = [];
  const pages: CrawlPageResult[] = [];
  let robotsAllowed: boolean | null = null;
  const sitemapUrls: string[] = [];

  const origin = new URL(startUrl).origin;
  for (const path of CRAWLER_DEFAULTS.priorityPaths) {
    queue.push(new URL(path, origin).href);
  }
  queue.unshift(startUrl);

  try {
    const robots = await safeFetch(new URL('/robots.txt', origin).href, options);
    if (robots.statusCode >= 200 && robots.statusCode < 300) {
      robotsAllowed = !/disallow:\s*\/\s*$/im.test(robots.body.split('\n').slice(0, 50).join('\n'));
      const sitemapMatch = robots.body.match(/sitemap:\s*(\S+)/i);
      if (sitemapMatch?.[1]) sitemapUrls.push(sitemapMatch[1]);
    }
  } catch {
    robotsAllowed = null;
  }

  try {
    const smUrl = sitemapUrls[0] ?? new URL('/sitemap.xml', origin).href;
    const sm = await safeFetch(smUrl, options);
    if (sm.statusCode >= 200 && sm.statusCode < 300) {
      const locs = [...sm.body.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map((m) => m[1]!.trim());
      for (const loc of locs.slice(0, 20)) {
        if (extractDomain(loc) === domain) queue.push(loc);
      }
    }
  } catch {
    /* optional */
  }

  queue.sort((a, b) => priorityScore(new URL(a).pathname) - priorityScore(new URL(b).pathname));

  while (queue.length > 0 && pages.length < maxPages) {
    const next = queue.shift()!;
    const key = next.replace(/\/$/, '');
    if (visited.has(key)) continue;
    visited.add(key);

    try {
      const res = await safeFetch(next, options);
      const page = toPageResult(res, 'HTTP');
      pages.push(page);
      if (res.statusCode >= 200 && res.statusCode < 400 && res.body.includes('<')) {
        const found = discoverLinks(res.body, res.finalUrl, domain);
        for (const link of found) {
          const k = link.replace(/\/$/, '');
          if (!visited.has(k)) queue.push(link);
        }
        queue.sort((a, b) => priorityScore(new URL(a).pathname) - priorityScore(new URL(b).pathname));
      }
    } catch (err) {
      pages.push({
        url: next,
        finalUrl: next,
        statusCode: 0,
        htmlHash: '',
        extractedText: '',
        htmlSnippet: '',
        headers: {},
        fetchMethod: 'HTTP',
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    }
  }

  let usedBrowser = false;
  const home = pages[0];
  const enablePw = options.enablePlaywright ?? playwrightEnabled();
  if (
    enablePw &&
    home &&
    shouldUseBrowser(home.htmlSnippet, home.statusCode)
  ) {
    try {
      const browserResult = await crawlWithPlaywright(startUrl, {
        ...options,
        maxPages,
        urls: pages.map((p) => p.url).slice(0, maxPages),
      });
      if (browserResult.pages.some((p) => p.statusCode >= 200 && p.statusCode < 400 && p.htmlSnippet.length > 100)) {
        return {
          startUrl,
          domain,
          robotsAllowed,
          pages: browserResult.pages,
          sitemapUrls,
          usedBrowser: true,
        };
      }
    } catch {
      /* keep HTTP results */
    }
  }

  return { startUrl, domain, robotsAllowed, pages, sitemapUrls, usedBrowser };
}

function toPageResult(res: FetchResult, method: 'HTTP' | 'PLAYWRIGHT'): CrawlPageResult {
  const $ = cheerio.load(res.body);
  const title = $('title').first().text().trim() || undefined;
  const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 5000);
  return {
    url: res.url,
    finalUrl: res.finalUrl,
    statusCode: res.statusCode,
    contentType: res.headers['content-type'],
    title,
    htmlHash: createHash('sha256').update(res.body).digest('hex'),
    extractedText: text,
    htmlSnippet: res.body.slice(0, 100_000),
    headers: res.headers,
    fetchMethod: method,
  };
}

export function verifyWebsite(input: WebsiteVerificationInput): WebsiteVerificationResult {
  const reasons: string[] = [];
  let score = 0;

  const domain = extractDomain(input.websiteUrl);
  if (!domain) {
    return { status: 'INVALID', confidence: 0, reasons: ['invalid_url'] };
  }
  if (domain.endsWith('.example.com') || domain.includes(normalizeToken(input.businessName).slice(0, 8))) {
    score += 0.25;
    reasons.push('domain_name_affinity');
  }

  const nameTokens = normalizeToken(input.businessName).split(' ').filter((t) => t.length > 2);
  const hay = `${input.pageTitle ?? ''} ${input.pageText ?? ''}`.toLowerCase();
  const hits = nameTokens.filter((t) => hay.includes(t)).length;
  if (nameTokens.length > 0) {
    const ratio = hits / nameTokens.length;
    score += 0.4 * ratio;
    if (ratio >= 0.5) reasons.push('name_on_page');
  }

  if (input.phone) {
    const digits = input.phone.replace(/\D/g, '');
    const last8 = digits.slice(-8);
    if (last8 && hay.replace(/\D/g, '').includes(last8)) {
      score += 0.25;
      reasons.push('phone_on_page');
    }
  }

  if (input.city && hay.includes(input.city.toLowerCase())) {
    score += 0.1;
    reasons.push('city_on_page');
  }

  const confidence = Math.max(0, Math.min(1, score));
  let status: WebsiteVerificationResult['status'];
  if (confidence >= 0.85) status = 'VERIFIED';
  else if (confidence >= 0.65) status = 'LIKELY';
  else if (confidence >= 0.35) status = 'UNCERTAIN';
  else status = 'INVALID';

  return { status, confidence, reasons };
}

function normalizeToken(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export * from './ssrf.js';
