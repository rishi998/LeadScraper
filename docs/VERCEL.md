# Deploy LeadScraper on Vercel

The **Next.js dashboard** (`apps/web`) deploys to Vercel. The **API** and **worker** must run elsewhere (Railway, Render, a VPS, etc.) because they need a long-running Node process, MongoDB, and optionally Playwright/Chrome.

## What runs where

| Component | Vercel | Railway / VPS |
|-----------|--------|---------------|
| Dashboard (`apps/web`) | Yes | — |
| API (`apps/api`) | No | Yes |
| Worker (`apps/worker`) | No | Yes |
| MongoDB | — | Atlas (cloud) |

## One-click Vercel setup (dashboard)

### 1. Import the repo

1. Go to [vercel.com/new](https://vercel.com/new) and import this Git repository.
2. Set **Root Directory** to `apps/web`.
3. Enable **Include source files outside of the Root Directory in the Build Step** (required for the pnpm monorepo).

Vercel should detect Next.js automatically. `apps/web/vercel.json` already sets install/build commands for the monorepo.

### 2. Environment variables (Vercel project)

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `API_URL` | Yes | `https://your-api.up.railway.app` | Server-only. Proxied via `/backend` — no CORS setup needed on the dashboard. |
| `NODE_VERSION` | Recommended | `20` | Match `engines` in root `package.json`. |

Do **not** set `MONGODB_URI` on Vercel — the dashboard never talks to MongoDB directly.

### 3. Deploy API + worker (Railway example)

On Railway (or similar), create **two services** from the same repo:

**API service**

- Start command: `pnpm --filter @leadintel/api start`
- Build command: `pnpm install && pnpm -r --filter=./packages/* build && pnpm --filter @leadintel/api build`
- Env: `MONGODB_URI`, `CORS_ORIGIN=https://your-app.vercel.app` (or `*` for testing)

**Worker service**

- Start command: `pnpm --filter @leadintel/worker start`
- Same build as API
- Env: `MONGODB_URI`, discovery/crawler vars from `.env.example`

Copy the public API URL into Vercel as `API_URL`.

### 4. Redeploy

After `API_URL` is set, redeploy the Vercel project. The dashboard calls `/backend/*`, which Next.js rewrites to your API.

## CLI deploy

From the repo root:

```bash
pnpm install
npx vercel link          # first time: set root directory to apps/web
npx vercel env add API_URL
npx vercel --prod
```

Or from `apps/web`:

```bash
cd apps/web
npx vercel --prod
```

## Local proxy test

Simulate production routing without CORS:

```powershell
$env:USE_API_PROXY="true"
$env:API_URL="http://localhost:3001"
pnpm --filter @leadintel/web dev
```

The app will use `http://localhost:3000/backend/...` instead of `:3001` directly.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Build can't find pnpm workspace | Enable “Include source files outside Root Directory”. |
| `API ... failed: 404` on Vercel | Set `API_URL` and redeploy. Check API `/health`. |
| CORS errors | Use `API_URL` proxy (recommended) or set `CORS_ORIGIN` on the API to your Vercel URL. |
| Empty data | API/worker must be running and connected to the same MongoDB Atlas database. |

## Health checks

- API: `GET https://your-api/health`
- Dashboard: open your Vercel URL → Dashboard should load stats when API is reachable.
