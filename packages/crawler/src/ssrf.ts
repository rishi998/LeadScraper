import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { CRAWLER_DEFAULTS, normalizeUrl } from '@leadintel/shared';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.google.com',
]);

export function isPrivateIp(ip: string): boolean {
  if (ip === '::1' || ip === '0.0.0.0') return true;
  if (ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd')) return true;
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return false;
  const [a, b] = parts as [number, number, number, number];
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

export async function assertSafeUrl(urlString: string): Promise<URL> {
  const normalized = normalizeUrl(urlString);
  if (!normalized) throw new Error(`Invalid URL: ${urlString}`);
  const url = new URL(normalized);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Blocked protocol: ${url.protocol}`);
  }
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith('.localhost')) {
    throw new Error(`Blocked hostname: ${host}`);
  }
  if (host === 'metadata' || host.includes('169.254.169.254')) {
    throw new Error(`Blocked metadata host: ${host}`);
  }

  const ips = isIP(host) ? [host] : (await lookup(host, { all: true })).map((r) => r.address);
  for (const ip of ips) {
    if (isPrivateIp(ip)) throw new Error(`Blocked private IP ${ip} for host ${host}`);
  }
  return url;
}

export interface FetchResult {
  url: string;
  finalUrl: string;
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  redirected: boolean;
}

export interface CrawlerOptions {
  userAgent?: string;
  timeoutMs?: number;
  maxContentBytes?: number;
  maxRedirects?: number;
  /** Injected fetch for tests / fixture servers */
  fetchImpl?: typeof fetch;
  /** Skip DNS SSRF checks (fixture localhost only) */
  allowPrivateNetwork?: boolean;
}

export async function safeFetch(urlString: string, options: CrawlerOptions = {}): Promise<FetchResult> {
  const timeoutMs = options.timeoutMs ?? CRAWLER_DEFAULTS.timeoutMs;
  const maxBytes = options.maxContentBytes ?? CRAWLER_DEFAULTS.maxContentBytes;
  const maxRedirects = options.maxRedirects ?? CRAWLER_DEFAULTS.maxRedirects;
  const fetchImpl = options.fetchImpl ?? fetch;

  let current = options.allowPrivateNetwork
    ? new URL(normalizeUrl(urlString) ?? urlString)
    : await assertSafeUrl(urlString);

  let redirected = false;
  for (let i = 0; i <= maxRedirects; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(current.href, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': options.userAgent ?? process.env.CRAWLER_USER_AGENT ?? 'LeadIntelBot/1.0',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const location = res.headers.get('location');
        if (!location) throw new Error(`Redirect without Location from ${current.href}`);
        redirected = true;
        const next = new URL(location, current);
        current = options.allowPrivateNetwork ? next : await assertSafeUrl(next.href);
        continue;
      }

      const contentLength = Number(res.headers.get('content-length') ?? '0');
      if (contentLength > maxBytes) throw new Error(`Content-Length exceeds limit: ${contentLength}`);

      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength > maxBytes) throw new Error(`Body exceeds size limit: ${buf.byteLength}`);

      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        headers[k.toLowerCase()] = v;
      });

      return {
        url: urlString,
        finalUrl: current.href,
        statusCode: res.status,
        headers,
        body: buf.toString('utf8'),
        redirected,
      };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`Too many redirects for ${urlString}`);
}
