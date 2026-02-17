# Methodology

## Query geometry

- Primary geometry: point + radius
  - `radius_primary_m = 150`
  - `radius_secondary_m = 400`
- Geospatial query syntax uses SODA `within_circle(...)` where location geometry exists.
- For geometry-gapped datasets, v1 uses transparent fallback matching (BIN/BBL/borough/community district/ZIP).

## Time windows

- 30-day window: 311 pulse + trend deltas.
- 90-day window: permits, complaints, collisions.
- 12-month window: ECB violations.
- Next 30 days: events and film permits.

## Ranking rules

- 311 pulse: sort complaint types by count in current 30-day window.
- Street works: active-now first, then longer duration, then closer geometry.
- Collisions: cluster collisions in 75m groups and label hotspot by most frequent intersection string.
- Events: borough feed is narrowed with local relevance scoring (community district, closure signal, nearby street text).

## Severity and impact framing

- Every module includes a Low/Medium/High severity chip plus a "What this means for you" sentence.
- Example thresholds:
  - Right now: Low 0 active disruptions, Medium 1-2, High 3+.
  - Street works: Low 0-1 active disruptions, Medium 2-4, High 5+.
  - Collisions: High if injuries 8+ or crashes 40+; Medium if injuries 3+ or crashes 15+.
  - 311 pulse: High if requests 350+ or 30-day increase 120+; Medium if requests 150+ or increase 50+.
  - Events: Low 0-7 locally relevant events, Medium 8-19, High 20+.

## Reliability and degradation

- Modules are fetched independently via `Promise.allSettled`.
- If one dataset fails, only that module degrades (`partial` or `unavailable`).
- Every module displays data source links and methodology text.

## Known v1 limitations

- Some official datasets do not expose stable point geometry.
- DSNY `p7k6-2pm8` is sparse via SODA API; fallback to `rv63-53db` is used in v1.
- Blockface-level precision is intentionally deferred to a future version.
