# Scoring

All scores are deterministic, versioned (`scoring@1.0.0`), configurable via constants in `packages/scoring`, and unit-tested.

**Rules:**
- Missing metric ≠ 0. Renormalize weights over reliable available dimensions.
- Lower `AuditConfidence` when important dimensions are missing.
- Technology names alone never cause negative scoring.
- AI never contributes to numeric scores.
- Clamp all final scores to 0–100.

## Score Types

| Score | Purpose |
|-------|---------|
| WebsiteHealthScore | Aggregate digital quality |
| MarketReadinessScore | Online visibility / local SEO readiness |
| ConversionReadinessScore | Ability to capture leads |
| BusinessVitalityScore | Operational / commercial vitality signals |
| ContactConfidenceScore | Quality of primary contact set |
| SalesOpportunityScore | Fit for sales outreach |
| AuditConfidenceScore | Trust in the audit itself |

## Website Health — Default Weights

| Dimension | Weight |
|-----------|--------|
| Performance | 18% |
| Mobile UX | 15% |
| SEO | 15% |
| Security | 12% |
| Accessibility | 10% |
| Technical Quality | 10% |
| Design/UX | 10% |
| Conversion | 10% |

### Renormalization

```
available = dimensions with reliable data (confidence ≥ threshold)
weight_i' = weight_i / sum(weights of available)
WebsiteHealth = Σ (score_i * weight_i')
```

If fewer than 3 dimensions available → cap WebsiteHealth contribution and set AuditConfidence penalty.

### Phase 1 Availability

Phase 1 implements SEO (basic), Security (passive basics), Conversion (CTA presence), Technical (basic). Performance/Accessibility/MobileUX/Design may be absent → renormalize.

## Conversion Readiness

Detect presence **and** prominence:

| Signal | Base | Prominence bonus |
|--------|------|------------------|
| Phone CTA | +12 | +8 if sticky/mobile Call Now |
| WhatsApp CTA | +12 | +6 if prominent |
| Email CTA | +8 | +4 |
| Contact form | +15 | +5 if above fold / dedicated page |
| Booking/appointment | +15 | +5 |
| Quote form | +10 | — |
| Live chat | +8 | — |
| Checkout | +10 | ecommerce context |
| Newsletter / lead magnet | +5 | — |

Cap at 100. Footer-only phone ≠ prominent CTA.

## Business Vitality

Graceful missing-data handling: start from neutral baseline (50) when sparse; adjust with available signals.

| Signal | Effect |
|--------|--------|
| Operational OPEN | +15 |
| CLOSED / TEMP_CLOSED | → force low opportunity (see modifiers) |
| Working contact channels | +10 |
| Business hours present | +5 |
| Online booking/ordering | +10 |
| Multiple locations | +5 |
| Recently verified info | +5 |
| Stale / uncertain website | −10 |

Missing signals leave score nearer baseline; do not pile zeros.

## Contact Confidence

Deterministic evidence signals:

### Email
| Signal | Weight |
|--------|--------|
| mailto link | 0.25 |
| On contact page | 0.20 |
| Same domain as website | 0.20 |
| In footer | 0.10 |
| Multiple occurrences | 0.10 |
| Valid syntax | 0.10 |
| Business context keywords | 0.05 |

### Phone
| Signal | Weight |
|--------|--------|
| tel: link | 0.25 |
| Contact page | 0.20 |
| Structured data | 0.20 |
| Multiple occurrences | 0.15 |
| Country validation | 0.20 |

Primary contact requires confidence ≥ 0.70 and status CONFIRMED or LIKELY. Low-confidence values never become Primary.

`ContactConfidenceScore` = weighted average of primary contacts (or best available), scaled 0–100.

## Sales Opportunity — Default Components

| Component | Weight |
|-----------|--------|
| Website Need | 25% |
| Conversion Gap | 20% |
| Marketing Gap | 15% |
| Business Vitality | 15% |
| Commercial Potential | 10% |
| Contactability | 10% |
| Evidence Confidence | 5% |

### Component Derivation (Phase 1)

- **Website Need** = `100 - WebsiteHealth` (or 90 if no website, 95 if broken)
- **Conversion Gap** = `100 - ConversionReadiness`
- **Marketing Gap** = based on analytics/pixel detection gaps (Phase 1: heuristic from missing GA/GTM; language = "not detected")
- **Business Vitality** = BusinessVitalityScore
- **Commercial Potential** = category baseline (configurable map; default 50)
- **Contactability** = ContactConfidenceScore
- **Evidence Confidence** = AuditConfidenceScore

### Modifiers

Applied after weighted sum, then clamp 0–100:

| Modifier | Effect |
|----------|--------|
| NO_WEBSITE | +15 Website Need path; opportunity boost capped; priority rules apply |
| BROKEN_WEBSITE | +10 opportunity (need), but require vitality check |
| HIGH_BUSINESS_VITALITY | +5 if vitality ≥ 75 |
| NO_RELIABLE_CONTACT | −20 |
| LOW_AUDIT_CONFIDENCE | −10 if auditConfidence < 50 |
| CLOSED_BUSINESS | set opportunity ≤ 25; **cannot** be HOT |

### Priority Bands

| Score | Priority |
|-------|----------|
| 80–100 | HOT |
| 60–79 | WARM |
| 40–59 | REVIEW |
| 0–39 | LOW |

Closed businesses must not become HOT solely due to bad websites.

## Audit Confidence

Factors (0–100):

| Factor | Weight |
|--------|--------|
| Crawl coverage (pages / expected) | 20% |
| Source quality | 15% |
| Website verification status | 20% |
| Contact confidence | 15% |
| Audit completeness (modules run) | 20% |
| Metric freshness | 10% |

## Data Quality Grade

| Grade | Criteria (Phase 1) |
|-------|---------------------|
| A | VERIFIED website + verified primary contact + audit complete + auditConfidence ≥ 85 |
| B | LIKELY/VERIFIED website + reliable contact + audit mostly complete + confidence ≥ 70 |
| C | Website uncertain or partial audit or weak contact; confidence ≥ 50 |
| D | Uncertain website, no reliable contact, incomplete audit, or conflicting evidence |

## Recommendation Rules (Deterministic)

Each rule emits `service`, `priority`, `reason`, `evidenceIds[]`. No recommendation without evidence IDs.

Examples:

```
IF performance < 45 AND businessVitality > 60
  → Performance Optimization (priority 1)

IF websiteHealth < 40 AND verification VERIFIED
  → Website Redesign

IF no website AND vitality > 55
  → Website Development

IF technicalSEO < 50 AND local signals present
  → Local SEO

IF conversionReadiness < 45 AND vitality > 50
  → Conversion Optimization

IF analytics not detected AND website VERIFIED
  → Analytics Setup
```

Full rule table lives in `packages/intelligence/src/rules.ts`.

## Lab vs Field Performance

- LAB = Lighthouse/synthetic (label metrics `dataSource: LAB`)
- FIELD = CrUX/RUM when available (`dataSource: FIELD`)
- Never present lab LCP as "real visitor performance" in exports/UI copy

## Versioning

Bump `ALGORITHM_VERSION` when weights or formulas change. Store version on every `Score` row. Methodology sheet embeds the version string.
