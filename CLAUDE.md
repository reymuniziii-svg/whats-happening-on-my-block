# CLAUDE.md

## About this repo

**What it does:** "What's Happening on My Block?" (NYC Block Brief) is a public, mobile-first Next.js web app. Given a single NYC address or BBL, it generates a shareable single-page "block brief" that aggregates civic data into plain-English modules: active closures/film permits ("right now"), DOB construction permits, street-work disruptions, collision safety trends, 311 complaint pulse (30-day deltas), sanitation pickup frequencies, upcoming events, and real-time MTA subway arrivals. Each module renders a headline, a "what this means for you" impact line, a Low/Medium/High severity chip with transparent thresholds, key metrics, expandable details, source links, and methodology text. Supports shareable `/b/{block_id}` pages and embeddable widgets.

**Stack:** Next.js 16 (App Router) + React 19 + TypeScript. Leaflet/OpenStreetMap for maps. Data from NYC Open Data SODA APIs; geocoding via NYC Geoclient v2 (preferred) with GeoSearch fallback; transit via MTA GTFS-realtime. Upstash Redis for cache + rate-limit (in-memory fallback). Zod for validation, Pino for logging. Tests: Vitest (unit/integration) + Playwright (e2e).

**Commands:**
- Install: `npm install` (postinstall runs `prisma generate`)
- Dev: `npm run dev` → http://127.0.0.1:3000
- Build: `npm run build` · Start: `npm run start`
- Lint: `npm run lint` · Typecheck: `npm run typecheck`
- Test: `npm run test` (unit + integration) · `npm run test:e2e` (Playwright)
- Requires `SOCRATA_APP_TOKEN` and `NEXT_PUBLIC_APP_URL`; `.env.example` documents the rest.

**Riskiest area:** External-data resilience. Every module depends on flaky third-party APIs (SODA, Geoclient, MTA) behind cache/rate-limit/fallback logic that must degrade independently without crashing the brief. The core paths to keep robust are geocoding (Geoclient→GeoSearch fallback, now cached) and brief assembly (`build-brief.ts`, which fans out modules via `Promise.allSettled` so one failed source never takes down the page).
