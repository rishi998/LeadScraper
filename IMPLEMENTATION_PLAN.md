# Implementation Plan

## Current State

Greenfield repository (empty). No existing code, git history, or schema.

## Documentation (Complete Before Code)

- [x] ARCHITECTURE.md
- [x] DATABASE_SCHEMA.md
- [x] SCORING.md
- [x] PIPELINE.md
- [x] EXCEL_SPEC.md
- [x] IMPLEMENTATION_PLAN.md

---

## Phase 1 — End-to-End Local Pipeline

**Status: Implemented on MongoDB Atlas + Mongoose.** No Docker / PostgreSQL / Prisma / Redis / BullMQ.

Queue: `MongoJobQueue` (atomic `findOneAndUpdate`). Worker remains `apps/worker`.

Goal: City/category → mock discovery → DB → crawl → contacts → basic audit → scores → Excel.

### Native runtime refactor — done
- Removed docker-compose and Docker docs
- Removed Redis/BullMQ runtime dependencies
- Added `ProcessingJob` model + worker polling loop
- SearchJob progress fields + dashboard display
- Per-domain crawl concurrency gate

---

## Original checklist

Goal: City/category → mock discovery → DB → crawl → contacts → basic audit → scores → Excel.

### P1.1 Monorepo Scaffold

1. Initialize pnpm workspace (`pnpm-workspace.yaml`, root `package.json`)
2. Shared TypeScript config (`tsconfig.base.json`)
3. ESLint + Prettier (minimal)
4. `.gitignore`, `.env.example` with `MONGODB_URI`
5. MongoDB Atlas (no local DB / Docker required)
6. Create empty package/app skeletons with `package.json` names

**Exit:** `pnpm install` succeeds.

### P1.2 Shared Package

1. Enums, constants, algorithm version
2. Zod schemas: SearchJob input, pipeline job payloads, AI stub schema
3. Provider storage policy types
4. Normalization helpers (name, phone, email, URL) — with unit tests

**Exit:** `@leadintel/shared` builds; normalization tests pass.

### P1.3 Database Package

1. Strict Mongoose schemas per DATABASE_SCHEMA.md (Phase 1 collections)
2. Indexes for search, domain, contacts, job claiming, audits
3. `connectMongo` / `disconnectMongo` / `idString`
4. Seed helper (optional)

**Exit:** Models compile; Atlas URI connects (`MONGODB_URI`).

### P1.4 Providers + Discovery

1. `BusinessDiscoveryProvider` interface + storage policy
2. `MockBusinessDiscoveryProvider` (deterministic fixtures by city/category)
3. Stubs: GooglePlaces, LicensedDirectory, SearchDiscovery, CSVImport
4. Geographic query expander (city × locality × category × aliases)
5. Discovery orchestrator writing DiscoveryQuery + Source + candidate Business

**Exit:** Unit test: mock search returns candidates with provenance.

### P1.5 Entity Resolution

1. Normalized keys + fuzzy name/address scoring
2. Strong weight for exact domain / phone
3. Merge preserving aliases/sources/evidence
4. Unit tests with fixture duplicates

**Exit:** Duplicate pair merges; sources retained.

### P1.6 Crawler (HTTP)

1. SSRF guard (private IP, metadata, non-http)
2. robots.txt / sitemap fetch (best-effort)
3. Cheerio HTML fetch with limits (timeout, size, redirects, concurrency, rate limit)
4. Priority URL discovery (max 15 pages)
5. Persist CrawlRun + CrawlPage
6. Fixture HTML server for tests (no live sites)

**Exit:** Integration test crawls fixture site.

### P1.7 Contacts

1. Extract mailto, tel, wa.me, basic schema
2. Normalize + dedupe
3. Confidence scoring
4. Evidence rows
5. Unit tests on fixture HTML

**Exit:** Contact extraction tests pass.

### P1.8 Website Verification (basic)

1. Compare domain/name/phone/title heuristics
2. Emit verification status + confidence
3. Unit tests

**Exit:** Official-looking fixture → VERIFIED/LIKELY; junk → INVALID.

### P1.9 Basic Audits

1. SEOAudit (title, meta, H1, viewport, canonical basics)
2. SecurityAudit (HTTPS, redirects, basic headers — passive)
3. ConversionAudit (CTA presence/prominence heuristics)
4. TechnicalAudit (status, broken link sample)
5. Audit orchestrator → AuditRun/Metric/Finding + Evidence

**Exit:** Fixture site produces deterministic findings.

### P1.10 Scoring + Recommendations

1. Implement scores per SCORING.md (Phase 1 dimensions)
2. Modifiers + priority bands
3. Data quality grade
4. Deterministic recommendation rules
5. Unit tests for formulas and edge cases (missing metrics, closed business)

**Exit:** Scoring tests pass; closed ≠ HOT.

### P1.11 Excel Package

1. ExcelJS multi-sheet writer per EXCEL_SPEC.md
2. Sanitization + formatting + conditional rules
3. Methodology sheet with algorithm version
4. Unit tests for sanitization

**Exit:** Generates valid `.xlsx` from fixture dataset.

### P1.12 Compliance (minimal)

1. Do-not-contact fields on Contact
2. Storage policy enforcement helpers
3. No outreach automation

**Exit:** Export omits DNC-flagged contact values when configured (or marks DNC columns).

### P1.13 Job queue + Worker

1. `JobQueue` interface + `MongoJobQueue` (atomic `findOneAndUpdate`)
2. Worker polling loop (retry, backoff, stale recovery, domain concurrency)
3. Idempotent stage processors + progress updates
4. Tier gating (T1/T2 only in Phase 1)

**Exit:** Starting a search job processes mock pipeline to scored businesses.

### P1.14 NestJS API

1. Modules: search-jobs, businesses, exports, health
2. Endpoints per spec (Phase 1 subset)
3. Zod/DTO validation
4. Wire Mongoose (`@nestjs/mongoose`) + `MongoJobQueue` producers

**Exit:** `POST /search-jobs` + `start` produces data queryable via GET.

### P1.15 Next.js Web (minimal)

1. Pages: Dashboard, Search Jobs, Businesses, Business Detail, Exports
2. Basic tables + filters (usable, not over-designed)
3. API client to NestJS

**Exit:** Can create job and view businesses in UI.

### P1.16 README + Verify

1. Comprehensive README
2. `pnpm typecheck` / lint / test
3. Fix failures
4. Document known Phase 1 limitations

**Exit criteria (milestone):**

```
City/category input
  → mock discovery
  → database
  → crawl (fixtures or allowed public URLs in dev)
  → contact extraction
  → basic audit
  → deterministic scores
  → Excel workbook
```

---

## Phase 2

**Status: Implemented.**

- [x] Playwright path when JS required (`shouldUseBrowser` + `crawlWithPlaywright`)
- [x] Performance adapter (`mock` default, `lighthouse`, `pagespeed`) — lab metrics only
- [x] Expanded `LocalTechnologyDetector` + marketing detection summary
- [x] Advanced SEO / security / conversion / a11y / mobile UX (`runFullAudits`)
- [x] Full AuditConfidence engine (includes freshness input)
- [x] Freshness policy (`isFresh` / `freshnessScore`) wired into crawl/audit/tech reuse

## Phase 3

- Real discovery provider adapters (licensed APIs only)
- CSV import
- Premium enrichment tier
- Provider usage metering

## Phase 4

- AIProvider interface + Zod-validated structured output
- Threshold gating; AiInsight storage
- Executive sheet narrative fields from AI when enabled

## Phase 5

- Dashboard analytics, job observability charts
- Manual review queues
- Operational metrics UI

---

## Execution Order (Immediate)

1. Write docs ← **done**
2. P1.1 → P1.3 (scaffold + shared + DB)
3. P1.4 → P1.11 (domain packages)
4. P1.13 → P1.14 (worker + API) — wire E2E
5. P1.15 (minimal web)
6. P1.16 (README + verify)

Do not start Phase 2 until Phase 1 milestone works end-to-end.
