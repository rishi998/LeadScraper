# Pipeline

## Flow

```
Search Configuration
  → Business Discovery
  → Raw Candidate Storage
  → Entity Resolution
  → Website Verification
  → Website Crawl
  → Contact Extraction
  → Contact Verification
  → Website Audit
  → Technology Detection
  → Marketing Detection
  → Business Signal Analysis
  → Scoring
  → Lead Qualification
  → Optional Premium Enrichment   (Tier 4)
  → Intelligence Generation         (rules always; AI Tier 5)
  → Quality Assurance
  → Excel Export
```

Every stage is **independently retryable** and **idempotent**.

## Search Configuration

Input (Zod-validated):

```json
{
  "city": "Faridabad",
  "state": "Haryana",
  "country": "India",
  "localities": [],
  "categories": ["dentist", "gym", "restaurant"],
  "categoryAliases": {},
  "targetLeadCount": 1000,
  "minimumOpportunityScore": 60,
  "enablePremiumEnrichment": false,
  "enableAIAnalysis": false
}
```

## Geographic Expansion

Large cities expand into query matrix:

```
city × localities[] × categories[] × categoryAliases[]
```

Example:

- Delhi → Rohini → dentist
- Delhi → Dwarka → dental clinic

Each matrix cell becomes a `DiscoveryQuery` with stored `queryText`. Every candidate retains the query that produced it via `Source.discoveryQueryId`.

If `localities` empty, run city-level queries only (Phase 1 mock may synthesize localities).

## Stage Contracts

### 1. Discovery (`discovery` queue)

**Input:** `searchJobId`  
**Idempotency:** `discovery:{searchJobId}:{discoveryQueryId}`  
**Actions:**
1. Expand geography/categories into DiscoveryQuery rows
2. Call `BusinessDiscoveryProvider.search`
3. Persist raw candidates as Source (+ provisional Business if policy allows)
4. Respect `ProviderStoragePolicy`
5. Enqueue entity-resolution when queries complete or batch threshold hit

**Tier:** 1

### 2. Entity Resolution (`entity-resolution`)

**Input:** `searchJobId`, optional `candidateIds`  
**Idempotency:** `er:{searchJobId}:{normalizedKey}`  
**Match signals:**
- normalized business name (fuzzy)
- domain (exact, strong)
- phone (normalized exact, strong)
- address / postal code
- coordinates (when available)

Produce `entityMatchScore`. Merge preserving aliases, sources, contacts, evidence. Never discard source records.

**Tier:** 1

### 3. Website Verification (`website-verification`)

**Input:** `businessId`  
**Idempotency:** `wv:{businessId}:{domain}`  
**Signals:** domain, name, address, phone, org schema, title, contacts  
**Output:** `websiteConfidence`, status VERIFIED | LIKELY | UNCERTAIN | INVALID

Fetches the homepage first (`fetchVerificationSample`); title/body text supply the name, phone,
and city signals. Without that fetch nothing can match and every site scores INVALID.

Only VERIFIED or high-confidence LIKELY (≥ 0.75) auto-advance to qualification path without manual review flag.

Crawl gate: VERIFIED or LIKELY advance to crawl. A reachable page that `shouldUseBrowser`
flags as a JS shell is undecidable over plain HTTP and also advances, so the crawler's
Playwright fallback can render it. INVALID and unreachable sites skip to scoring.

**Tier:** 1

### 4. Crawl (`crawl`)

**Input:** `businessId`, `websiteId`  
**Idempotency:** `crawl:{websiteId}:{freshnessBucket}`  
**Behavior:**
- Check freshness (default 7 days)
- robots.txt + sitemap.xml
- Priority paths: `/`, contact, about, services, locations, pricing
- HTTP + Cheerio first; Playwright only if `shouldUseBrowser` (JS shell / sparse DOM)
- Persist `usedBrowser` + per-page `fetchMethod`
- Max 15 pages/domain; env-wired timeouts/size/UA
- SSRF guards; skip crawl when fresh (7 days)

**Tier:** 2–3

### 5. Contact Extraction (`contact-extraction`)

**Input:** `businessId`, `crawlRunId`  
**Idempotency:** `contacts:{crawlRunId}`  
Extract phone, WhatsApp, email, forms from mailto/tel/wa.me/schema/footer/header/contact/about/locations. Normalize, dedupe, evidence, confidence. No private personal harvesting focus.

**Tier:** 2

### 6. Audit (`audit`)

**Input:** `businessId`, `crawlRunId`  
**Idempotency:** `audit:{crawlRunId}:{modulesHash}`  
Modules: advanced SEO, Security, Conversion, Technical, Accessibility, Mobile UX + PerformanceProvider (`mock` | `lighthouse` | `pagespeed`).  
Lab metrics only — never labeled as field/CrUX. Append-only `AuditRun`. Performance reused when fresh (14 days).

**Tier:** 2–3

### 7. Technology (`technology`)

**Input:** `businessId`, `crawlRunId`  
**Idempotency:** `tech:{crawlRunId}`  
`LocalTechnologyDetector` via `createTechnologyProvider()`; optional Wappalyzer stub behind flag.  
Marketing tags use "detected" / "not detected". Reused when fresh (30 days).

**Tier:** 2

### 8. Scoring (`scoring`)

**Input:** `businessId`, `auditRunId`  
**Idempotency:** `score:{businessId}:{auditRunId}:{algorithmVersion}`  
Website Health renormalizes available dimensions (incl. performance/a11y/mobile).  
`AuditConfidence` uses crawl coverage, source quality, verification, contact confidence, completeness, freshness. 
Compute all scores, priority, recommendations (deterministic rules), data quality grade. Update denormalized Business fields.

**Tier:** 2

### 9. Enrichment (`enrichment`) — Phase 3+

Only if `enablePremiumEnrichment` and lead qualifies (priority ≥ WARM, auditConfidence ≥ threshold).

**Tier:** 4

### 10. AI Analysis (`ai-analysis`) — Phase 4

Only if `enableAIAnalysis` and opportunity ≥ threshold. Structured JSON validated by Zod. Stored as AiInsight only.

**Tier:** 5

### 11. Export (`export`)

**Input:** `exportRunId`  
**Idempotency:** `export:{exportRunId}`  
QA pass: dedupe, validate emails/phones/URLs, strip invalid contacts, sanitize formula injection. Write multi-sheet workbook.

## Job Semantics

Jobs are MongoDB `processing_jobs` documents claimed with atomic `findOneAndUpdate` (priority desc, createdAt asc). Attempts increment on claim. Retries use backoff (5s, 30s). Stale PROCESSING locks are recovered periodically.

**No Redis/BullMQ/PostgreSQL.** `JobQueue` → `MongoJobQueue`.

## Promotion Gates

```
T1 complete → if has website candidate → T2
T2 complete → if opportunity ≥ minimum OR needs browser metrics → T3
qualified + flag → T4 / T5
```

Stop early when `targetLeadCount` of qualified leads reached (configurable).

## Freshness Defaults

| Artifact | TTL |
|----------|-----|
| crawl | 7 days |
| performance audit | 14 days |
| technology | 30 days |
| contact verification | 30 days |

Provider storage restrictions override TTLs.

## Failure Handling

- Stage failure marks job failed; parent SearchJob aggregates errors
- Partial success allowed: business may have contacts without full audit
- Dead-letter after max retries; visible in API/logs
- Never swallow errors without structured log + DB errorMessage
