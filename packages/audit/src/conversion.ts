import * as cheerio from 'cheerio';
import { FindingSeverity } from '@leadintel/shared';
import { f, m } from './helpers.js';
import type { AuditInput, ModuleAuditResult } from './types.js';

export function runConversionAudit(input: AuditInput): ModuleAuditResult {
  const metrics = [];
  const findings = [];
  let score = 0;

  const allHtml = input.pages.map((p) => p.htmlSnippet ?? '').join('\n');
  const $ = cheerio.load(allHtml);

  const phoneCta = $('a[href^="tel:"]').length > 0;
  const whatsapp = $('a[href*="wa.me"], a[href*="whatsapp"]').length > 0;
  const emailCta = $('a[href^="mailto:"]').length > 0;
  const forms = $('form');
  const form = forms.length > 0;
  let formFields = 0;
  forms.each((_, el) => {
    formFields += $(el).find('input, textarea, select').length;
  });
  const booking = /book|appoint|schedule|reserve/i.test(allHtml);
  const sticky = /sticky|fixed|call now|whatsapp/i.test(allHtml);
  const trust =
    /google maps|reviews?|testimonial|rated|years? of experience|licensed|certified/i.test(allHtml) ||
    /address|street|road|avenue/i.test(allHtml);

  const add = (name: string, present: boolean, base: number, prominence = 0) => {
    metrics.push(m('CONVERSION', name, present ? 1 : 0));
    if (present) score += base + prominence;
  };

  add('phoneCta', phoneCta, 12, sticky && phoneCta ? 8 : 0);
  add('whatsappCta', whatsapp, 12, sticky && whatsapp ? 6 : 0);
  add('emailCta', emailCta, 8, 0);
  add('contactForm', form, 15, /contact/i.test(input.pages.map((p) => p.url).join(' ')) ? 5 : 0);
  add('bookingCta', booking, 15, 0);
  add('trustSignals', trust, 10, 0);
  metrics.push(m('CONVERSION', 'formFieldCount', formFields));
  if (form && formFields >= 3) score += 5;

  if (!phoneCta && !whatsapp && !form) {
    findings.push(
      f(
        'CONVERSION',
        FindingSeverity.MAJOR,
        'LOW_CONVERSION',
        'No prominent phone, WhatsApp, or contact form detected',
        input.websiteUrl,
      ),
    );
  }

  const capped = Math.min(100, score);
  metrics.push(m('CONVERSION', 'conversionReadinessScore', capped));
  return { module: 'CONVERSION', score: capped, confidence: 0.75, metrics, findings };
}
