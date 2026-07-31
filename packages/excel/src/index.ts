import ExcelJS from 'exceljs';
import { SCORING_ALGORITHM_VERSION, sanitizeExcelCell } from '@leadintel/shared';

export interface ExcelLeadRow {
  leadId: string;
  priority?: string | null;
  dataQualityGrade?: string | null;
  businessName: string;
  category?: string | null;
  subcategory?: string | null;
  city?: string | null;
  locality?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  address?: string | null;
  website?: string | null;
  websiteVerification?: string | null;
  operationalStatus?: string | null;
  primaryPhone?: string | null;
  whatsapp?: string | null;
  primaryEmail?: string | null;
  websiteHealth?: number | null;
  marketReadiness?: number | null;
  conversionReadiness?: number | null;
  businessVitality?: number | null;
  contactConfidence?: number | null;
  salesOpportunity?: number | null;
  auditConfidence?: number | null;
  primaryProblem?: string | null;
  evidenceSummary?: string | null;
  businessImpact?: string | null;
  recommendedService?: string | null;
  secondaryService?: string | null;
  whyContact?: string | null;
  openingPitch?: string | null;
  lastVerified?: Date | string | null;
  socialProfiles?: string | null;
  discoverySource?: string | null;
  sourceIds?: string | null;
  discoveredAt?: Date | string | null;
  doNotContact?: boolean;
  optOutDate?: Date | string | null;
  domain?: string | null;
  websiteStatus?: string | null;
  statusCode?: number | null;
  https?: boolean | null;
  tlsValid?: boolean | null;
  performance?: number | null;
  accessibility?: number | null;
  bestPractices?: number | null;
  seo?: number | null;
  lcp?: number | null;
  inp?: number | null;
  cls?: number | null;
  fcp?: number | null;
  ttfb?: number | null;
  mobileUx?: number | null;
  technicalSeo?: number | null;
  security?: number | null;
  conversion?: number | null;
  titlePresent?: boolean | null;
  descriptionPresent?: boolean | null;
  h1Present?: boolean | null;
  canonical?: boolean | null;
  robots?: boolean | null;
  sitemap?: boolean | null;
  structuredData?: boolean | null;
  brokenLinks?: number | null;
  contactForm?: boolean | null;
  whatsappCta?: boolean | null;
  phoneCta?: boolean | null;
  bookingCta?: boolean | null;
  analytics?: string | null;
  gtm?: string | null;
  metaPixel?: string | null;
  clarity?: string | null;
  cms?: string | null;
  framework?: string | null;
  libraries?: string | null;
  cdn?: string | null;
  criticalIssues?: string | null;
  majorIssues?: string | null;
  minorIssues?: string | null;
  auditDate?: Date | string | null;
}

export interface ExcelContactRow {
  leadId: string;
  businessName: string;
  contactType: string;
  contactValue: string;
  context?: string | null;
  role?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  confidence?: number | null;
  verificationStatus?: string | null;
  verifiedAt?: Date | string | null;
  primaryContact?: boolean;
}

export interface ExcelExportInput {
  leads: ExcelLeadRow[];
  contacts: ExcelContactRow[];
  exportedAt?: Date;
}

function cell(value: unknown): ExcelJS.CellValue {
  const sanitized = sanitizeExcelCell(value);
  if (sanitized === null) return '';
  return sanitized as ExcelJS.CellValue;
}

function addHeader(sheet: ExcelJS.Worksheet, headers: string[]) {
  sheet.addRow(headers.map((h) => cell(h)));
  const row = sheet.getRow(1);
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
  row.alignment = { vertical: 'middle', wrapText: true };
  sheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: headers.length },
  };
}

function styleScoreColumn(sheet: ExcelJS.Worksheet, column: number, rowCount: number) {
  for (let r = 2; r <= rowCount + 1; r++) {
    const v = Number(sheet.getRow(r).getCell(column).value);
    if (Number.isNaN(v)) continue;
    let color = 'FFF4CCCC';
    if (v >= 80) color = 'FFC6EFCE';
    else if (v >= 60) color = 'FFFFEB9C';
    else if (v >= 40) color = 'FFFFC7CE';
    sheet.getRow(r).getCell(column).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: color },
    };
  }
}

export async function buildWorkbook(input: ExcelExportInput): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'LeadIntel';
  wb.created = input.exportedAt ?? new Date();

  const execHeaders = [
    'Lead ID', 'Priority', 'Data Quality Grade', 'Business Name', 'Category', 'City', 'Locality',
    'Website', 'Primary Phone', 'WhatsApp', 'Primary Email',
    'Website Health', 'Market Readiness', 'Conversion Readiness', 'Business Vitality',
    'Contact Confidence', 'Sales Opportunity',
    'Primary Problem', 'Evidence Summary', 'Business Impact',
    'Recommended Service', 'Secondary Service', 'Why Contact', 'Opening Pitch',
    'Audit Confidence', 'Last Verified',
  ];
  const exec = wb.addWorksheet('01 Executive Leads');
  addHeader(exec, execHeaders);
  for (const lead of input.leads) {
    const row = exec.addRow([
      lead.leadId, lead.priority, lead.dataQualityGrade, lead.businessName, lead.category,
      lead.city, lead.locality, lead.website, lead.primaryPhone, lead.whatsapp, lead.primaryEmail,
      lead.websiteHealth, lead.marketReadiness, lead.conversionReadiness, lead.businessVitality,
      lead.contactConfidence, lead.salesOpportunity,
      lead.primaryProblem, lead.evidenceSummary, lead.businessImpact,
      lead.recommendedService, lead.secondaryService, lead.whyContact, lead.openingPitch,
      lead.auditConfidence, lead.lastVerified,
    ].map(cell));
    if (lead.priority === 'HOT') {
      row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6B6B' } };
    }
    if (!lead.website) {
      row.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };
    }
    if (!lead.primaryPhone && !lead.primaryEmail && !lead.whatsapp) {
      row.getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };
    }
    if ((lead.auditConfidence ?? 100) < 50) {
      row.getCell(25).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };
    }
    if (lead.website && typeof lead.website === 'string') {
      row.getCell(8).value = { text: String(sanitizeExcelCell(lead.website)), hyperlink: lead.website };
    }
  }
  styleScoreColumn(exec, 12, input.leads.length);
  styleScoreColumn(exec, 17, input.leads.length);
  exec.columns.forEach((c) => {
    c.width = 16;
  });
  exec.getColumn(4).width = 28;
  exec.getColumn(18).width = 36;
  exec.getColumn(24).width = 40;

  const profile = wb.addWorksheet('02 Business Profiles');
  addHeader(profile, [
    'Lead ID', 'Business Name', 'Category', 'Subcategory', 'Address', 'Locality', 'City', 'State',
    'Postal Code', 'Country', 'Website', 'Website Verification', 'Operational Status',
    'Social Profiles', 'Discovery Source', 'Source IDs', 'Discovered At', 'Last Verified',
  ]);
  for (const lead of input.leads) {
    profile.addRow([
      lead.leadId, lead.businessName, lead.category, lead.subcategory, lead.address, lead.locality,
      lead.city, lead.state, lead.postalCode, lead.country, lead.website, lead.websiteVerification,
      lead.operationalStatus, lead.socialProfiles, lead.discoverySource, lead.sourceIds,
      lead.discoveredAt, lead.lastVerified,
    ].map(cell));
  }

  const audits = wb.addWorksheet('03 Website Audits');
  addHeader(audits, [
    'Lead ID', 'Domain', 'Website Status', 'Status Code', 'HTTPS', 'TLS Valid',
    'Performance', 'Accessibility', 'Best Practices', 'SEO',
    'LCP', 'INP', 'CLS', 'FCP', 'TTFB',
    'Mobile UX', 'Technical SEO', 'Security', 'Conversion',
    'Title Present', 'Description Present', 'H1 Present', 'Canonical', 'Robots', 'Sitemap', 'Structured Data',
    'Broken Links', 'Contact Form', 'WhatsApp CTA', 'Phone CTA', 'Booking CTA',
    'Analytics', 'GTM', 'Meta Pixel', 'Clarity', 'CMS', 'Framework', 'Libraries', 'CDN',
    'Critical Issues', 'Major Issues', 'Minor Issues',
    'Website Health', 'Audit Confidence', 'Audit Date',
  ]);
  for (const lead of input.leads) {
    audits.addRow([
      lead.leadId, lead.domain, lead.websiteStatus, lead.statusCode, lead.https, lead.tlsValid,
      lead.performance, lead.accessibility, lead.bestPractices, lead.seo,
      lead.lcp, lead.inp, lead.cls, lead.fcp, lead.ttfb,
      lead.mobileUx, lead.technicalSeo, lead.security, lead.conversion,
      lead.titlePresent, lead.descriptionPresent, lead.h1Present, lead.canonical, lead.robots,
      lead.sitemap, lead.structuredData, lead.brokenLinks, lead.contactForm, lead.whatsappCta,
      lead.phoneCta, lead.bookingCta, lead.analytics, lead.gtm, lead.metaPixel, lead.clarity,
      lead.cms, lead.framework, lead.libraries, lead.cdn,
      lead.criticalIssues, lead.majorIssues, lead.minorIssues,
      lead.websiteHealth, lead.auditConfidence, lead.auditDate,
    ].map(cell));
  }

  const contacts = wb.addWorksheet('04 Contacts');
  addHeader(contacts, [
    'Lead ID', 'Business Name', 'Contact Type', 'Contact Value', 'Context', 'Role',
    'Source', 'Source URL', 'Confidence', 'Verification Status', 'Verified At', 'Primary Contact',
  ]);
  for (const c of input.contacts) {
    contacts.addRow([
      c.leadId, c.businessName, c.contactType, c.contactValue, c.context, c.role,
      c.source, c.sourceUrl, c.confidence, c.verificationStatus, c.verifiedAt, c.primaryContact,
    ].map(cell));
  }

  const crm = wb.addWorksheet('05 Outreach CRM');
  addHeader(crm, [
    'Lead ID', 'Business Name', 'Priority', 'Sales Opportunity', 'Recommended Service',
    'Assignee', 'Status', 'Contact Method', 'First Contact', 'Last Contact', 'Next Follow-Up',
    'Response', 'Interested', 'Objection', 'Proposal Sent', 'Proposal Value', 'Outcome', 'Revenue',
    'Do Not Contact', 'Opt-Out Date', 'Notes',
  ]);
  for (const lead of input.leads) {
    const row = crm.addRow([
      lead.leadId, lead.businessName, lead.priority, lead.salesOpportunity, lead.recommendedService,
      '', '', '', '', '', '', '', '', '', '', '', '', '',
      lead.doNotContact ?? false, lead.optOutDate, '',
    ].map(cell));
    if (lead.doNotContact) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
    }
  }

  const method = wb.addWorksheet('06 Methodology');
  const lines = [
    ['Lead Intelligence Export Methodology'],
    ['Export timestamp', (input.exportedAt ?? new Date()).toISOString()],
    ['Scoring algorithm version', SCORING_ALGORITHM_VERSION],
    [],
    ['Score definitions'],
    ['Website Health', 'Weighted aggregate of available audit dimensions; missing dimensions are omitted and weights renormalized.'],
    ['Sales Opportunity', 'Website Need 25%, Conversion Gap 20%, Marketing Gap 15%, Business Vitality 15%, Commercial Potential 10%, Contactability 10%, Evidence Confidence 5%.'],
    ['Priority thresholds', 'HOT 80–100, WARM 60–79, REVIEW 40–59, LOW 0–39. Closed businesses cannot be HOT.'],
    ['Contact confidence', 'Deterministic evidence weights (mailto/tel/schema/page context). Primary requires confidence ≥ 0.70.'],
    ['Data quality grades', 'A: verified website + verified primary contact + complete audit + confidence ≥ 85. D: uncertain website / no reliable contact / incomplete audit.'],
    ['Lab vs field performance', 'LAB metrics are synthetic/Lighthouse-style. FIELD metrics are real-user data. Lab results are never labeled as actual visitor performance.'],
    ['Not detected', 'Means the signal was not observed on crawled public pages. It does not prove absence of offline/ad activity.'],
    ['Data-source limitations', 'Mock/discovery provider data and public website extracts only. Provider storage/export policies are enforced.'],
    ['AI', 'AI output (when enabled) is stored separately and never becomes factual Evidence.'],
  ];
  for (const line of lines) {
    method.addRow(line.map(cell));
  }
  method.getColumn(1).width = 28;
  method.getColumn(2).width = 100;
  method.getRow(1).font = { bold: true, size: 14 };

  return wb.xlsx.writeBuffer();
}

export { sanitizeExcelCell };
