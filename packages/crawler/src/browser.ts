import { createHash } from 'node:crypto';
import * as cheerio from 'cheerio';
import { CRAWLER_DEFAULTS, extractDomain } from '@leadintel/shared';
import { assertSafeUrl, type CrawlerOptions } from './ssrf.js';
import type { CrawlPageResult } from './types.js';

export interface BrowserCrawlOptions extends CrawlerOptions {
  maxPages?: number;
  executablePath?: string;
  urls?: string[];
}

/** Heuristic: HTTP body looks like a JS shell that needs a real browser. */
export function shouldUseBrowser(html: string, statusCode: number): boolean {
  if (statusCode < 200 || statusCode >= 400) return false;
  const body = html ?? '';
  const textLen = body.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    .length;
  if (textLen < 80 && body.length > 200) return true;
  if (/id=["']root["']|id=["']app["']|__NEXT_DATA__|ng-version|data-reactroot/i.test(body) && textLen < 400) {
    return true;
  }
  if (/Please enable JavaScript|noscript|webpackJsonp|window\.__INITIAL_STATE__/i.test(body) && textLen < 300) {
    return true;
  }
  return false;
}

export function playwrightEnabled(): boolean {
  if (process.env.PLAYWRIGHT_SKIP === 'true') return false;
  if (process.env.ENABLE_PLAYWRIGHT === 'false') return false;
  return true;
}

export async function crawlWithPlaywright(
  startUrl: string,
  options: BrowserCrawlOptions = {},
): Promise<{ pages: CrawlPageResult[]; usedBrowser: true }> {
  if (!options.allowPrivateNetwork) {
    await assertSafeUrl(startUrl);
  }

  const { chromium } = await import('playwright');
  const maxPages = options.maxPages ?? CRAWLER_DEFAULTS.maxPages;
  const timeoutMs = options.timeoutMs ?? CRAWLER_DEFAULTS.timeoutMs;
  const domain = extractDomain(startUrl);
  if (!domain) throw new Error(`Cannot extract domain from ${startUrl}`);

  const origin = new URL(startUrl).origin;
  const seed =
    options.urls ??
    [
      startUrl,
      ...CRAWLER_DEFAULTS.priorityPaths.map((p) => new URL(p, origin).href),
    ].slice(0, maxPages);

  const browser = await chromium.launch({
    headless: true,
    executablePath: options.executablePath || process.env.CHROME_EXECUTABLE_PATH || undefined,
  });

  const pages: CrawlPageResult[] = [];
  try {
    const context = await browser.newContext({
      userAgent: options.userAgent ?? process.env.CRAWLER_USER_AGENT ?? 'LeadIntelBot/1.0',
    });
    const page = await context.newPage();
    const visited = new Set<string>();

    for (const url of seed) {
      if (pages.length >= maxPages) break;
      const key = url.replace(/\/$/, '');
      if (visited.has(key)) continue;
      visited.add(key);
      if (extractDomain(url) !== domain) continue;

      try {
        if (!options.allowPrivateNetwork) await assertSafeUrl(url);
        const response = await page.goto(url, {
          waitUntil: 'networkidle',
          timeout: timeoutMs,
        });
        const finalUrl = page.url();
        const statusCode = response?.status() ?? 0;
        const html = await page.content();
        const $ = cheerio.load(html);
        const title = $('title').first().text().trim() || undefined;
        const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 5000);
        const headers: Record<string, string> = {};
        const hdrs = response?.headers() ?? {};
        for (const [k, v] of Object.entries(hdrs)) headers[k.toLowerCase()] = v;

        pages.push({
          url,
          finalUrl,
          statusCode,
          contentType: headers['content-type'],
          title,
          htmlHash: createHash('sha256').update(html).digest('hex'),
          extractedText: text,
          htmlSnippet: html.slice(0, options.maxContentBytes ?? CRAWLER_DEFAULTS.maxContentBytes),
          headers,
          fetchMethod: 'PLAYWRIGHT',
        });
      } catch (err) {
        pages.push({
          url,
          finalUrl: url,
          statusCode: 0,
          htmlHash: '',
          extractedText: '',
          htmlSnippet: '',
          headers: {},
          fetchMethod: 'PLAYWRIGHT',
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      }
    }
    await context.close();
  } finally {
    await browser.close();
  }

  return { pages, usedBrowser: true };
}
