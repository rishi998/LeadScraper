# LeadIntel — Business Lead Intelligence Platform

MongoDB Atlas + Mongoose monorepo. Discovers businesses, verifies websites, extracts public contacts, audits, scores, and exports Excel.

> No Docker · No PostgreSQL · No Prisma · No Redis · No BullMQ

## Architecture

```
Next.js → NestJS API → MongoDB Atlas
MongoDB Atlas ↔ Worker → Crawl/Audit/Scoring → MongoDB → Excel
```

See [ARCHITECTURE.md](./ARCHITECTURE.md), [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md), [PIPELINE.md](./PIPELINE.md).

## Windows setup

### Requirements

- Node.js 20+
- pnpm 9+
- MongoDB Atlas connection string
- Chrome/Chromium optional (`pnpm playwright:install`)

### Configure

```powershell
pnpm install
Copy-Item .env.example .env
```

Set in `.env`:

```env
MONGODB_URI=mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/lead_intelligence?retryWrites=true&w=majority
```

Never put `MONGODB_URI` in Next.js `NEXT_PUBLIC_*` vars.

API and worker load the monorepo root `.env` automatically (and fix Windows `mongodb+srv` DNS via public resolvers).

### Run

```powershell
pnpm -r --filter=./packages/* build
pnpm dev
```

Or separately: `pnpm dev:api` · `pnpm dev:worker` · `pnpm dev:web`

- API: http://localhost:3001/health  
- Web: http://localhost:3000  

## Deploy to Vercel (dashboard)

The Next.js app deploys to Vercel; API + worker run on Railway/VPS + MongoDB Atlas.

1. Import repo on Vercel with **Root Directory** = `apps/web`
2. Enable **Include source files outside of the Root Directory**
3. Set env var **`API_URL`** = your public API URL (e.g. Railway)
4. Deploy API/worker separately — see [docs/VERCEL.md](./docs/VERCEL.md)

```bash
npx vercel --cwd apps/web
```

## Job queue

`MongoJobQueue` uses atomic `findOneAndUpdate` with sort `{ priority: -1, createdAt: 1 }`.  
Retries: 5s → 30s → fail. Stale PROCESSING locks recovered by `WORKER_LOCK_TIMEOUT_MS`.

## Phase 2

- Playwright crawl fallback for JS shells (`ENABLE_PLAYWRIGHT`)
- Performance lab metrics (`PERFORMANCE_PROVIDER=mock|lighthouse|pagespeed`)
- Accessibility + mobile UX audits; advanced SEO/security/conversion
- Freshness reuse for crawl (7d), performance (14d), technology (30d)
- AuditConfidence includes real freshness score

Optional Chromium: `pnpm playwright:install`

## Tests

```powershell
pnpm test
pnpm typecheck
```

Unit tests use in-memory queue where possible. Integration tests may use `MONGODB_TEST_URI` (never production).

## Excel

Six sheets preserved: Executive Leads, Business Profiles, Website Audits, Contacts, Outreach CRM, Methodology. Lead ID = ObjectId string.
