const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const NON_EMAIL_SUFFIXES = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.css', '.js'];

export function normalizeBusinessName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(pvt|ltd|llc|inc|co|company|private|limited)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeEmail(email: string): string | null {
  const withoutScheme = email.trim().replace(/^mailto:/i, '');
  // mailto hrefs carry ?subject=/&body= params, extra recipients, and percent-encoding.
  const [addressPart = ''] = withoutScheme.split(/[?#,;\s]/);
  let cleaned: string;
  try {
    cleaned = decodeURIComponent(addressPart).trim().toLowerCase();
  } catch {
    cleaned = addressPart.trim().toLowerCase();
  }
  if (!EMAIL_RE.test(cleaned)) return null;
  if (NON_EMAIL_SUFFIXES.some((suffix) => cleaned.endsWith(suffix))) return null;
  return cleaned;
}

/** E.164-ish normalization for common formats; keeps digits with optional leading +. */
export function normalizePhone(phone: string, defaultCountryCode = '91'): string | null {
  let raw = phone.trim().replace(/^tel:/i, '');
  raw = raw.replace(/[^\d+]/g, '');
  if (raw.startsWith('00')) raw = `+${raw.slice(2)}`;
  if (raw.startsWith('+')) {
    const digits = raw.slice(1).replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) return null;
    return `+${digits}`;
  }
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  if (digits.length === 10 && defaultCountryCode) {
    return `+${defaultCountryCode}${digits}`;
  }
  return `+${digits}`;
}

export function normalizeUrl(url: string): string | null {
  try {
    const withProtocol = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    parsed.hash = '';
    let href = parsed.href;
    if (href.endsWith('/') && parsed.pathname === '/') {
      href = href.slice(0, -1);
    }
    return href;
  } catch {
    return null;
  }
}

export function extractDomain(url: string): string | null {
  const normalized = normalizeUrl(url);
  if (!normalized) return null;
  try {
    return new URL(normalized).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return null;
  }
}

export function normalizePostalCode(postal: string): string {
  return postal.replace(/\s+/g, '').toUpperCase();
}

export function normalizeAddressKey(parts: {
  line1?: string | null;
  locality?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
}): string {
  return [
    parts.line1,
    parts.locality,
    parts.city,
    parts.postalCode ? normalizePostalCode(parts.postalCode) : null,
    parts.country,
  ]
    .filter(Boolean)
    .map((p) => normalizeBusinessName(String(p)))
    .join('|');
}

/** Prevent Excel formula injection for untrusted scraped strings. */
export function sanitizeExcelCell(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  const str = String(value);
  if (/^[=+\-@]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

export function clampScore(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n * 10) / 10));
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      const cur =
        a[i - 1] === b[j - 1]
          ? row[j - 1]!
          : 1 + Math.min(row[j - 1]!, prev, row[j]!);
      row[j - 1] = prev;
      prev = cur;
    }
    row[b.length] = prev;
  }
  return row[b.length]!;
}

export function similarityRatio(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const distance = levenshtein(a, b);
  return 1 - distance / Math.max(a.length, b.length);
}
