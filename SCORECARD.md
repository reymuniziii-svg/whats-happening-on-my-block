# Repo Scorecard — What's Happening on My Block? (NYC Block Brief)

> **Status — resolved 2026-06-13:** Every finding below was addressed in the same session this review kicked off — both high-severity bugs fixed, the insecure-default secret and the entire watchlist/digest subsystem removed, and the ~3k LOC of dead code deleted. Retained as the original point-in-time snapshot.

**Reviewed:** 2026-06-13 · **Branch:** `main` (clean working tree) · **Scope:** whole repo
**Reviewer:** repo-review (does-it-run + bug-hunter + simplifier subagents; auth surface independently verified)

> ## Health: 3 / 5 — Needs work (targeted)
> A genuinely well-built, fully-working app held back by **two high-severity data-accuracy bugs** that put visibly wrong information in front of users, plus ~3,000 LOC of deletable dead code and one insecure-default secret. None of it is a rewrite: every fix below is small and localized. Fix the two high bugs + the signing-secret default, delete the dead code, and this is a solid 4.

---

## About this repo

A public, mobile-first **Next.js 16 (App Router) + React 19 + TypeScript** web app. Given one NYC address or BBL, it generates a shareable single-page "block brief" aggregating civic data into plain-English modules (active closures/film permits, DOB construction, street works, collision trends, 311 pulse with 30-day deltas, sanitation frequencies, events, and real-time MTA subway arrivals) — each with a headline, impact line, Low/Medium/High severity chip, metrics, and methodology. **Stack:** NYC Open Data SODA APIs, Geoclient→GeoSearch geocoding, MTA GTFS-realtime, Leaflet/OSM maps, Upstash Redis (cache + rate-limit, in-memory fallback), Prisma+Postgres (optional watchlist/digest), Google Sheets export. Zod validation, Pino logging, Vitest + Playwright.
**Commands:** `npm install` → `npm run dev` (:3000) · `npm run build` · `npm run test` / `test:e2e` · `npm run lint` / `typecheck`.
**Riskiest area:** the external-data + auth boundary — flaky third-party APIs behind cache/fallback logic, and the cron/watchlist secrets. (Full version in [CLAUDE.md](CLAUDE.md), written during this review.)

---

## Phase 1 — Does it work?  ✅ (does-it-run verdict, verbatim)

- **builds: yes** — `next build` compiled successfully in 10.3s with Turbopack; all routes generated; zero TypeScript or lint errors.
- **tests: pass** — Vitest 22/22 unit+integration (10 files, 1.73s); Playwright e2e 12/15 passed, 3 skipped by explicit `test.skip()` (2 require `CRON_SECRET`, 1 permanently skipped).
- **runs: yes** — dev server up in 667ms; `GET /api/health` → `{"ok":true,"service":"whats-happening-on-my-block",...,"cache_backend":"memory"}`.
- **blockers: none** — all steps passed; the 3 skipped e2e tests are intentional conditional skips, not defects.

---

## Phase 2 — Correctness (top 3 of 6 verified findings)

| # | Sev | Location | Defect |
|---|-----|----------|--------|
| 1 | **High** (95%) | `src/lib/transit/scoring.ts:19-31` | `severityWeight` matches the numeric GTFS-RT `Effect` enum via decimal-substring `String(effect).includes(...)`, which **inverts severity**: `NO_SERVICE` (1) scores lowest while `NO_EFFECT` (10) scores highest (`"10".includes("10")`). Directly drives the user-facing "High impact alerts" stat and transit badge. *Fix: map by exact enum value.* |
| 2 | **High** (90%) | `src/lib/modules/dob-permits.ts:122-127` | When a location resolves with **no BBL and no BIN** (common for GeoSearch/intersection results), the ECB-violations query loses its parcel filter and **counts every violation citywide** as this block's "ECB violations (12m)", forcing the module to "High" severity for nearly every BBL-less address. *Fix: skip the query unless a real locator is present.* |
| 3 | **Med** (90%) | `src/lib/geocode/resolve-location.ts:20` | `part[0].toUpperCase()` throws on a borough string with a double/leading space (empty split segment), turning the whole `/api/brief` request into a **500**. *Fix: guard empty segments before mapping.* |

*Also found (lower severity): digest writes N duplicate Google-Sheet rows for a block watched by N sessions (`digest/service.ts:96-131`, med); SODA window queries use UTC vs. the dataset's Eastern `floating_timestamp`, ~4–5h skew (`query-builders.ts`, low); film module counts citywide permits as "nearby" when borough+zip are absent (`film.ts`, low).*

**Verified clean (notable strengths):** brief assembly uses `Promise.allSettled` throughout, so one failed source never crashes the brief; SoQL escaping is correct and public params are `z.number()`/validated (no injection); 311 delta math, cache TTL, and Redis→memory + rate-limit fallbacks are sound.

---

## Phase 3 — Overbuilt check  →  Verdict: **Mildly overbuilt**

Core app is lean and well-factored (module registry, SODA client, cache/rate-limit fallbacks, Prisma models, single shared `BriefResponse` type — all used, none over-abstracted). The bloat is concentrated and deletion-only:

| # | Delete | LOC | Why safe |
|---|--------|-----|----------|
| 1 | `src/lib 2/` (entire dir, 21 files) | ~2,248 | Byte-for-byte duplicate of `src/lib/`; **zero `@/lib 2` imports**; already in `.gitignore:47` yet committed; only compiles because tsconfig globs `**/*.ts`. |
| 2 | v1 HTTP API — 5 route files | ~675 | Deprecated with `Sunset: 2026-06-01` (already past); frontend uses v2 everywhere except one line (`SearchForm.tsx:130`). Repoint that line, delete the routes. (Keep the v1 *builder* — still used by `/embed` + digest.) |
| 3 | `src/lib/observability/metrics.ts` + ~13 call sites | ~50 | In-process latency counters reset every Vercel cold start and aren't shared across instances → meaningless; only reader is `/api/health`. |

*Plus small dead exports: `moduleLogger()` (`logger.ts:24`), `module_status` diagnostics field.* **Total deletable: ~3,000 LOC across ~27 files.**

---

## Phase 4 — Security (high/medium only)

> Note: `/security-review` and `/code-review` are diff-scoped and the tree is clean, so this pass came from the bug-hunter's security-sensitive sweep plus an independent read of the auth files.

| Sev | Location | Finding |
|-----|----------|---------|
| **Med** | `src/lib/watchlist/session-token.ts:4` | HMAC signing secret falls back to a **hardcoded public default** (`"dev-watchlist-secret-change-me"`) when `WATCHLIST_SIGNING_SECRET` is unset, with no warning. A production deploy missing that var signs session tokens with a known secret → **forgeable watchlists**. Impact bounded (anonymous block-ID lists, no PII). *Fix: fail closed / refuse to sign in production when the env var is absent.* |
| Low | `src/app/api/internal/cron/digest/route.ts:16` | Cron bearer-token compared with non-constant-time `===` — negligible for a high-entropy server-to-server secret; harden with `timingSafeEqual` for consistency. |

**Verified sound:** cron endpoint requires `CRON_SECRET` and rejects (401) when unset; watchlist token verification uses a length check + `timingSafeEqual` and can't be forged without the secret; no SoQL injection (escaping correct, numeric params validated); no user-controlled fetch URLs — SODA base is hardcoded and MTA feed URLs are env/hardcoded (no SSRF).

---

## Phase 5 — Bottom line

**Score 3/5 · Recommended action: Needs work (targeted).** This is a high-craft project — green CI (lint + typecheck + unit + integration + e2e + build), uptime monitoring, route-level error/loading boundaries, graceful per-source degradation, HMAC sessions, Zod validation, transparent methodology. It loses points only because its *core promise — accurate, severity-ranked civic data —* is undermined by two high-severity bugs (fully inverted transit severity; citywide DOB violations mislabeled as local), and because ~3k LOC of committed dead code inflates the surface. All fixes are small and localized.

**Do these three things, in order:**
1. Fix the two high-severity data bugs (`transit/scoring.ts` enum mapping; `dob-permits.ts` locator gate) and the `resolve-location.ts` 500 — they directly affect what users see.
2. Make `WATCHLIST_SIGNING_SECRET` fail closed in production (remove the hardcoded fallback).
3. Delete `src/lib 2/`, the deprecated v1 routes, and `metrics.ts` (~3k LOC, pure deletion).

*No source files were modified during this review. `CLAUDE.md` was created in Phase 0 as orientation documentation.*
