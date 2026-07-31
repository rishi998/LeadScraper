# Excel Export Specification

Generated with ExcelJS. Shared **Lead ID** (`Business.id`) across all sheets.

## Sheets

| # | Name | Purpose |
|---|------|---------|
| 01 | Executive Leads | Sales-ready summary |
| 02 | Business Profiles | Firmographic / discovery |
| 03 | Website Audits | Technical audit snapshot |
| 04 | Contacts | All contacts |
| 05 | Outreach CRM | Manual CRM tracking template |
| 06 | Methodology | Score definitions & caveats |

## Pre-Export QA

1. Deduplicate businesses (canonical entity)
2. Validate emails (syntax)
3. Normalize phone numbers
4. Normalize URLs
5. Remove obviously invalid contacts
6. Sanitize strings beginning with `=`, `+`, `-`, `@` (formula injection)
7. Enforce provider storage/export policy (omit prohibited fields)

## 01 Executive Leads

| Column |
|--------|
| Lead ID |
| Priority |
| Data Quality Grade |
| Business Name |
| Category |
| City |
| Locality |
| Website |
| Primary Phone |
| WhatsApp |
| Primary Email |
| Website Health |
| Market Readiness |
| Conversion Readiness |
| Business Vitality |
| Contact Confidence |
| Sales Opportunity |
| Primary Problem |
| Evidence Summary |
| Business Impact |
| Recommended Service |
| Secondary Service |
| Why Contact |
| Opening Pitch |
| Audit Confidence |
| Last Verified |

Phase 1: Primary Problem / Impact / Why Contact / Opening Pitch filled from deterministic recommendation summaries (AI fields empty or rule-based stubs until Phase 4).

## 02 Business Profiles

| Column |
|--------|
| Lead ID |
| Business Name |
| Category |
| Subcategory |
| Address |
| Locality |
| City |
| State |
| Postal Code |
| Country |
| Website |
| Website Verification |
| Operational Status |
| Social Profiles |
| Discovery Source |
| Source IDs |
| Discovered At |
| Last Verified |

Only export provider-sourced fields when policy permits.

## 03 Website Audits

| Column |
|--------|
| Lead ID |
| Domain |
| Website Status |
| Status Code |
| HTTPS |
| TLS Valid |
| Performance |
| Accessibility |
| Best Practices |
| SEO |
| LCP |
| INP |
| CLS |
| FCP |
| TTFB |
| Mobile UX |
| Technical SEO |
| Security |
| Conversion |
| Title Present |
| Description Present |
| H1 Present |
| Canonical |
| Robots |
| Sitemap |
| Structured Data |
| Broken Links |
| Contact Form |
| WhatsApp CTA |
| Phone CTA |
| Booking CTA |
| Analytics |
| GTM |
| Meta Pixel |
| Clarity |
| CMS |
| Framework |
| Libraries |
| CDN |
| Critical Issues |
| Major Issues |
| Minor Issues |
| Website Health |
| Audit Confidence |
| Audit Date |

Missing metrics left blank (not 0). Label lab metrics clearly in Methodology.

## 04 Contacts

| Column |
|--------|
| Lead ID |
| Business Name |
| Contact Type |
| Contact Value |
| Context |
| Role |
| Source |
| Source URL |
| Confidence |
| Verification Status |
| Verified At |
| Primary Contact |

## 05 Outreach CRM

| Column |
|--------|
| Lead ID |
| Business Name |
| Priority |
| Sales Opportunity |
| Recommended Service |
| Assignee |
| Status |
| Contact Method |
| First Contact |
| Last Contact |
| Next Follow-Up |
| Response |
| Interested |
| Objection |
| Proposal Sent |
| Proposal Value |
| Outcome |
| Revenue |
| Do Not Contact |
| Opt-Out Date |
| Notes |

## 06 Methodology

Must explain:
- All score definitions
- Weightings
- Priority thresholds
- Confidence methodology
- Data quality grades
- Audit methodology
- Field vs lab performance distinction
- Data-source limitations
- Meaning of "not detected"
- Export timestamp
- Scoring algorithm version

## Formatting Requirements

- Freeze header row on all data sheets
- Freeze Lead ID column where practical
- AutoFilter enabled
- Excel Tables (`Table` objects) per sheet
- Wrap long text columns
- Sensible column widths
- Date format: `YYYY-MM-DD HH:mm`
- Numbers: 0–100 scores as `0.0`
- Hyperlinks for Website, Source URL, emails (`mailto:`), phones where useful

### Conditional Formatting

**Website Health**
| Range | Style meaning |
|-------|----------------|
| 0–39 | critical |
| 40–59 | poor |
| 60–79 | moderate |
| 80–100 | strong |

**Sales Opportunity / Priority**
| Range | Label |
|-------|-------|
| 80–100 | HOT |
| 60–79 | WARM |
| 40–59 | REVIEW |
| 0–39 | LOW |

### Row Highlights

- HOT leads
- No website
- Broken website
- Missing contact
- Low audit confidence
- Overdue follow-up (Outreach)
- Do Not Contact

No decorative/random styling. Professional sales-intelligence appearance: clean header fill, thin borders, consistent fonts.
