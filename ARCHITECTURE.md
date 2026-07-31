# Architecture

## Overview

Lead Intelligence Platform — modular TypeScript monorepo.

**Runtime:** Node.js, pnpm, MongoDB Atlas (Mongoose), optional Chrome/Chromium.  
**Not required:** Docker, PostgreSQL, Prisma, Redis, BullMQ.

## Topology

```
Next.js Dashboard
       ↓
  NestJS API  (@nestjs/mongoose)
       ↓
  MongoDB Atlas
       ↕
     Worker
       ↓
 Discovery → Crawl → Contacts → Audit → Scoring
       ↓
  MongoDB Atlas → Excel Export
```

Browser never talks to MongoDB. `MONGODB_URI` stays server-side only.

## Job transport

`JobQueue` interface → **`MongoJobQueue`**

Atomic claim:

```
findOneAndUpdate(
  { status: PENDING, availableAt: { $lte: now } },
  { $set: { status: PROCESSING, lockedAt, lockedBy }, $inc: { attempts: 1 } },
  { sort: { priority: -1, createdAt: 1 }, new: true }
)
```

Crawl/audit work runs **outside** any DB transaction.

## Data model

Separate collections for independent lifecycles (businesses, contacts, websites, audit_runs, evidence, processing_jobs, …).  
Embed only small bounded data (e.g. `Business.currentScores`, `AuditRun.metrics`, `SearchJob.discoveryQueries`).

## Packages

Domain logic in `packages/*`. Persistence in `@leadintel/database` (Mongoose schemas). Queue in `@leadintel/job-queue`.

## Phase 2 capabilities

- **Crawl:** HTTP/Cheerio first; Playwright fallback when the page looks like a JS shell (`ENABLE_PLAYWRIGHT`, `CHROME_EXECUTABLE_PATH`).
- **Performance:** `PerformanceProvider` — default `mock`; opt-in `lighthouse` (Playwright lab timings) or `pagespeed` (`PAGESPEED_API_KEY`). Lab-only provenance.
- **Audits:** SEO, security, conversion, technical, accessibility, mobile UX → append-only `audit_runs`.
- **Technology:** expanded local fingerprints + marketing detection summary.
- **Freshness:** `isFresh` / `freshnessScore` in `@leadintel/shared` (crawl 7d, performance 14d, technology 30d, contacts 30d).
- **AuditConfidence:** weighted formula in `@leadintel/scoring` with real freshness input.
