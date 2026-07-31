export interface CrawlPageResult {
  url: string;
  finalUrl: string;
  statusCode: number;
  contentType?: string;
  title?: string;
  htmlHash: string;
  extractedText: string;
  htmlSnippet: string;
  headers: Record<string, string>;
  fetchMethod?: 'HTTP' | 'PLAYWRIGHT';
  errorMessage?: string;
}

export interface CrawlResult {
  startUrl: string;
  domain: string;
  robotsAllowed: boolean | null;
  pages: CrawlPageResult[];
  sitemapUrls: string[];
  usedBrowser: boolean;
}
