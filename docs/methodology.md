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

## Reliability and degradation

- Modules are fetched independently via `Promise.allSettled`.
- If one dataset fails, only that module degrades (`partial` or `unavailable`).
- Every module displays data source links and methodology text.

## Known v1 limitations

- Some official datasets do not expose stable point geometry.
- DSNY `p7k6-2pm8` is sparse via SODA API; fallback to `rv63-53db` is used in v1.
- Blockface-level precision is intentionally deferred to a future version.
