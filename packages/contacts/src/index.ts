import * as cheerio from 'cheerio';
import {
  ContactType,
  PRIMARY_CONTACT_MIN_CONFIDENCE,
  VerificationStatus,
  extractDomain,
  normalizeEmail,
  normalizePhone,
} from '@leadintel/shared';

export interface ExtractedContact {
  type: ContactType;
  value: string;
  rawValue: string;
  context: string;
  confidence: number;
  verificationStatus: VerificationStatus;
  source: string;
  sourceUrl: string;
  method: string;
}

export interface ContactPageInput {
  url: string;
  html: string;
  websiteDomain?: string | null;
}

const EMAIL_TEXT_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const PHONE_TEXT_RE = /(?:\+?\d[\d\s().-]{7,}\d)/g;

/** Machine-generated addresses (error-tracker DSNs, template placeholders) are not leads. */
function isNoiseEmail(email: string): boolean {
  const [local = '', domain = ''] = email.split('@');
  if (local.length > 64) return true;
  if (/^[0-9a-f]{16,}$/i.test(local)) return true;
  if (/^(you|your|youremail|someone|user|username|name|email|test|example)$/i.test(local)) {
    return true;
  }
  if (/(^|\.)sentry[.-]/i.test(domain)) return true;
  if (/(^|\.)wixpress\.com$/i.test(domain)) return true;
  if (/(^|\.)(sentry\.io|localhost|invalid)$/i.test(domain)) return true;
  return false;
}

/**
 * Cheerio's `.text()` joins adjacent nodes with no separator, which welds neighbouring
 * labels onto addresses ("reservationsinfo@x.com"). Replacing tags with spaces keeps
 * word boundaries intact.
 */
function visibleText($: cheerio.CheerioAPI): string {
  $('script, style, noscript, template').remove();
  return ($('body').html() ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ');
}

export function extractContactsFromHtml(input: ContactPageInput): ExtractedContact[] {
  const $ = cheerio.load(input.html);
  const pageUrl = input.url;
  const path = new URL(pageUrl).pathname.toLowerCase();
  const isContactPage = /contact|about|location/.test(path);
  const domain = input.websiteDomain ?? extractDomain(pageUrl);
  const found = new Map<string, ExtractedContact>();

  const upsert = (c: ExtractedContact) => {
    const key = `${c.type}:${c.value}`;
    const existing = found.get(key);
    if (!existing || c.confidence > existing.confidence) found.set(key, c);
  };

  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const email = normalizeEmail(href);
    if (!email || isNoiseEmail(email)) return;
    upsert(
      scoreEmail({
        email,
        raw: href,
        sourceUrl: pageUrl,
        domain,
        isContactPage,
        method: 'MAILTO',
        inFooter: isIn($, el, 'footer'),
        occurrences: 1,
      }),
    );
  });

  $('a[href^="tel:"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const phone = normalizePhone(href);
    if (!phone) return;
    upsert(
      scorePhone({
        phone,
        raw: href,
        sourceUrl: pageUrl,
        isContactPage,
        method: 'TEL',
        inStructured: false,
        occurrences: 1,
      }),
    );
  });

  $('a[href*="wa.me"], a[href*="api.whatsapp.com"], a[href*="whatsapp"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const match = href.match(/(?:wa\.me\/|phone=)(\+?\d+)/i);
    const phone = normalizePhone(match?.[1] ?? href);
    if (!phone) return;
    upsert({
      type: ContactType.WHATSAPP,
      value: phone,
      rawValue: href,
      context: isContactPage ? 'contact-page' : 'link',
      confidence: isContactPage ? 0.9 : 0.75,
      verificationStatus: VerificationStatus.LIKELY,
      source: 'BUSINESS_WEBSITE',
      sourceUrl: pageUrl,
      method: 'WHATSAPP_LINK',
    });
  });

  $('form').each((_, el) => {
    const action = ($(el).attr('action') ?? '').toLowerCase();
    const html = $(el).html()?.toLowerCase() ?? '';
    if (action.includes('contact') || html.includes('email') || html.includes('message') || html.includes('phone')) {
      const formUrl = action ? new URL(action, pageUrl).href : pageUrl;
      upsert({
        type: ContactType.CONTACT_FORM,
        value: formUrl,
        rawValue: action || pageUrl,
        context: isContactPage ? 'contact-page' : 'form',
        confidence: isContactPage ? 0.8 : 0.6,
        verificationStatus: VerificationStatus.LIKELY,
        source: 'BUSINESS_WEBSITE',
        sourceUrl: pageUrl,
        method: 'CONTACT_FORM',
      });
    }
  });

  // JSON-LD telephone / email
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text();
    try {
      const data = JSON.parse(raw) as Record<string, unknown> | Record<string, unknown>[];
      const nodes = Array.isArray(data) ? data : [data];
      for (const node of nodes) {
        const email = typeof node.email === 'string' ? normalizeEmail(node.email) : null;
        if (email && !isNoiseEmail(email)) {
          upsert(
            scoreEmail({
              email,
              raw: node.email as string,
              sourceUrl: pageUrl,
              domain,
              isContactPage: true,
              method: 'SCHEMA_ORG',
              inFooter: false,
              occurrences: 1,
            }),
          );
        }
        const tel = typeof node.telephone === 'string' ? normalizePhone(node.telephone) : null;
        if (tel) {
          upsert(
            scorePhone({
              phone: tel,
              raw: node.telephone as string,
              sourceUrl: pageUrl,
              isContactPage: true,
              method: 'SCHEMA_ORG',
              inStructured: true,
              occurrences: 1,
            }),
          );
        }
      }
    } catch {
      /* ignore invalid json-ld */
    }
  });

  const bodyText = visibleText($);
  for (const match of bodyText.match(EMAIL_TEXT_RE) ?? []) {
    const email = normalizeEmail(match);
    if (!email || isNoiseEmail(email)) continue;
    upsert(
      scoreEmail({
        email,
        raw: match,
        sourceUrl: pageUrl,
        domain,
        isContactPage,
        method: 'TEXT',
        inFooter: false,
        occurrences: 1,
      }),
    );
  }

  for (const match of bodyText.match(PHONE_TEXT_RE) ?? []) {
    const phone = normalizePhone(match);
    if (!phone) continue;
    upsert(
      scorePhone({
        phone,
        raw: match,
        sourceUrl: pageUrl,
        isContactPage,
        method: 'TEXT',
        inStructured: false,
        occurrences: 1,
      }),
    );
  }

  return [...found.values()].sort((a, b) => b.confidence - a.confidence);
}

export function selectPrimaryContacts(contacts: ExtractedContact[]): ExtractedContact[] {
  const primaries: ExtractedContact[] = [];
  for (const type of [ContactType.PHONE, ContactType.EMAIL, ContactType.WHATSAPP]) {
    const best = contacts
      .filter(
        (c) =>
          c.type === type &&
          c.confidence >= PRIMARY_CONTACT_MIN_CONFIDENCE &&
          c.verificationStatus !== VerificationStatus.REJECTED,
      )
      .sort((a, b) => b.confidence - a.confidence)[0];
    if (best) primaries.push(best);
  }
  return primaries;
}

function scoreEmail(args: {
  email: string;
  raw: string;
  sourceUrl: string;
  domain: string | null | undefined;
  isContactPage: boolean;
  method: string;
  inFooter: boolean;
  occurrences: number;
}): ExtractedContact {
  let confidence = 0;
  if (args.method === 'MAILTO') confidence += 0.25;
  if (args.method === 'SCHEMA_ORG') confidence += 0.2;
  if (args.isContactPage) confidence += 0.2;
  if (args.domain && args.email.endsWith(`@${args.domain}`) || (args.domain && args.email.split('@')[1]?.endsWith(args.domain))) {
    confidence += 0.2;
  }
  if (args.inFooter) confidence += 0.1;
  if (args.occurrences > 1) confidence += 0.1;
  confidence += 0.1; // valid syntax already gated
  if (/info|sales|contact|hello|admin|support/.test(args.email)) confidence += 0.05;

  confidence = Math.min(1, confidence);
  return {
    type: ContactType.EMAIL,
    value: args.email,
    rawValue: args.raw,
    context: args.isContactPage ? 'contact-page' : args.inFooter ? 'footer' : 'page',
    confidence,
    verificationStatus:
      confidence >= 0.85 ? VerificationStatus.CONFIRMED : confidence >= 0.7 ? VerificationStatus.LIKELY : VerificationStatus.UNVERIFIED,
    source: 'BUSINESS_WEBSITE',
    sourceUrl: args.sourceUrl,
    method: args.method,
  };
}

function scorePhone(args: {
  phone: string;
  raw: string;
  sourceUrl: string;
  isContactPage: boolean;
  method: string;
  inStructured: boolean;
  occurrences: number;
}): ExtractedContact {
  let confidence = 0;
  if (args.method === 'TEL') confidence += 0.25;
  if (args.isContactPage) confidence += 0.2;
  if (args.inStructured || args.method === 'SCHEMA_ORG') confidence += 0.2;
  if (args.occurrences > 1) confidence += 0.15;
  if (args.phone.startsWith('+') && args.phone.length >= 11) confidence += 0.2;
  confidence = Math.min(1, confidence);
  return {
    type: ContactType.PHONE,
    value: args.phone,
    rawValue: args.raw,
    context: args.isContactPage ? 'contact-page' : 'page',
    confidence,
    verificationStatus:
      confidence >= 0.85 ? VerificationStatus.CONFIRMED : confidence >= 0.7 ? VerificationStatus.LIKELY : VerificationStatus.UNVERIFIED,
    source: 'BUSINESS_WEBSITE',
    sourceUrl: args.sourceUrl,
    method: args.method,
  };
}

function isIn($: cheerio.CheerioAPI, el: unknown, tag: string): boolean {
  return $(el as never).closest(tag).length > 0;
}
