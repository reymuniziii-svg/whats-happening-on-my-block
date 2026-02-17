# What's Happening on My Block? (NYC Block Brief)

A public, mobile-first NYC address tool that generates a shareable block brief in seconds.

Live app: https://whats-happening-on-my-block.vercel.app

Repo: https://github.com/reymuniziii-svg/whats-happening-on-my-block

## What it does

Given one NYC address (or BBL), the app returns a single-page brief with:

- Right now strip (active closures, street works, and film permits)
- Construction and DOB signals
- Street disruption signals
- Collision safety trends
- 311 pulse with 30-day deltas
- Sanitation area frequencies
- Upcoming events and film activity

Every module shows:

- Plain-English headline
- "What this means for you" impact sentence
- Low/Medium/High severity chip with transparent thresholds
- 2-4 key metrics
- Expandable details list
- Data source links
- "How this is calculated" methodology text

## Stack

- Next.js 16 (App Router) + TypeScript
- React + Leaflet (OpenStreetMap)
- NYC Open Data SODA APIs
- Geoclient v2 (preferred) with NYC GeoSearch fallback
- In-memory per-block and per-dataset caching

## Routes

- `/` search page
- `/b/{block_id}` shareable brief page
- `/about`
- `/methodology`
- `GET /api/brief?address=...`
- `GET /api/brief?bbl=...`
- `GET /api/brief/by-block/{block_id}`
- `GET /api/health`

## Data model

`BriefResponse` lives at:

- `src/types/brief.ts`

Includes:

- `input`
- `location`
- `updated_at_utc`
- `parameters`
- `modules[]`
- `map`

## Quickstart

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000)

## Environment variables

Required:

- `SOCRATA_APP_TOKEN`
- `NEXT_PUBLIC_APP_URL`

Optional (recommended):

- `GEOCLIENT_APP_ID`
- `GEOCLIENT_APP_KEY`

Optional future cache backend:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

## Production reliability setup

- Deploy on Vercel and set `main` as production branch for auto-deploys.
- Keep the CI workflow green (`.github/workflows/ci.yml`) to block broken merges.
- Monitor `GET /api/health` with an external uptime monitor (UptimeRobot or Better Stack).
- The brief page has route-level loading/error boundaries, and each module degrades independently if a source fails.

## Tests

```bash
npm run test
npm run test:e2e
```

## Scripts

```bash
npm run capture:screenshots
npm run capture:demo
```

These generate Gallery assets in `submission/`:

- `hero-1.png`
- `hero-2.png`
- `demo.gif` (or `demo.webm` when ffmpeg is unavailable)

## Add a module

See:

- `docs/add-module.md`

## Methodology and datasets

- `docs/methodology.md`
- `submission/datasets.md`

## Notes on sanitation source fallback

As of February 17, 2026, `p7k6-2pm8` is sparse via SODA API responses in this implementation path. v1 uses `rv63-53db` fallback while keeping `p7k6-2pm8` documented as the preferred source.
