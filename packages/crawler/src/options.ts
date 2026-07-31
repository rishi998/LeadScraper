import { CRAWLER_DEFAULTS } from '@leadintel/shared';
import type { CrawlerOptions } from './ssrf.js';

export function loadCrawlerOptionsFromEnv(
  overrides: CrawlerOptions & { maxPages?: number } = {},
): CrawlerOptions & { maxPages?: number; executablePath?: string } {
  return {
    userAgent: process.env.CRAWLER_USER_AGENT ?? overrides.userAgent,
    timeoutMs: Number(process.env.CRAWLER_TIMEOUT_MS ?? overrides.timeoutMs ?? CRAWLER_DEFAULTS.timeoutMs),
    maxContentBytes: Number(
      process.env.CRAWLER_MAX_CONTENT_BYTES ?? overrides.maxContentBytes ?? CRAWLER_DEFAULTS.maxContentBytes,
    ),
    maxPages: Number(process.env.CRAWLER_MAX_PAGES ?? overrides.maxPages ?? CRAWLER_DEFAULTS.maxPages),
    executablePath: process.env.CHROME_EXECUTABLE_PATH || undefined,
    ...overrides,
  };
}
