import type { NearbyTransitStation } from "@/lib/transit/gtfs-static";
import type { TransitAlert } from "@/lib/transit/alerts";

export interface RankedTransitAlert {
  alert: TransitAlert;
  score: number;
  matchedStationCount: number;
  severity: "low" | "medium" | "high";
}

function parseTimestamp(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? undefined : parsed;
}

// GTFS-realtime Effect enum (gtfs-realtime.d.ts): 1 NO_SERVICE, 2 REDUCED_SERVICE,
// 3 SIGNIFICANT_DELAYS, 4 DETOUR, 5 ADDITIONAL_SERVICE, 6 MODIFIED_SERVICE,
// 7 OTHER_EFFECT, 8 UNKNOWN_EFFECT, 9 STOP_MOVED, 10 NO_EFFECT, 11 ACCESSIBILITY_ISSUE.
// alerts.ts stores effect as String(numericEnum) (e.g. "1".."11"); names are accepted defensively.
const EFFECT_NAME_TO_CODE: Record<string, number> = {
  no_service: 1,
  reduced_service: 2,
  significant_delays: 3,
  detour: 4,
  additional_service: 5,
  modified_service: 6,
  other_effect: 7,
  unknown_effect: 8,
  stop_moved: 9,
  no_effect: 10,
  accessibility_issue: 11,
};

const HIGH_IMPACT_EFFECTS = new Set([1, 3, 4]); // no service, significant delays, detour
const MEDIUM_IMPACT_EFFECTS = new Set([2, 6]); // reduced / modified service

function effectCode(effect?: string): number {
  const raw = (effect ?? "").trim().toLowerCase();
  if (!raw) {
    return 0;
  }
  const numeric = Number(raw);
  if (Number.isInteger(numeric) && numeric > 0) {
    return numeric;
  }
  return EFFECT_NAME_TO_CODE[raw] ?? 0;
}

function severityWeight(alert: TransitAlert): number {
  const code = effectCode(alert.effect);
  if (HIGH_IMPACT_EFFECTS.has(code)) {
    return 7;
  }
  if (MEDIUM_IMPACT_EFFECTS.has(code)) {
    return 4;
  }
  return 2;
}

function severityLabel(score: number): "low" | "medium" | "high" {
  if (score >= 9) {
    return "high";
  }
  if (score >= 5) {
    return "medium";
  }
  return "low";
}

export function rankTransitAlerts(
  alerts: TransitAlert[],
  stations: NearbyTransitStation[],
  nowIso: string,
): RankedTransitAlert[] {
  const now = new Date(nowIso).getTime();
  const stationIds = new Set(stations.flatMap((station) => [station.station_id, ...station.aliases]));

  return alerts
    .map((alert) => {
      const matched = alert.stop_ids.filter((stopId) => stationIds.has(stopId));
      const start = parseTimestamp(alert.starts_at_utc);
      const end = parseTimestamp(alert.ends_at_utc);

      let score = severityWeight(alert);
      if (matched.length > 0) {
        score += 6;
      }
      if (start !== undefined && Math.abs(start - now) <= 24 * 60 * 60 * 1000) {
        score += 2;
      }
      if (end !== undefined && end < now) {
        score -= 3;
      }

      return {
        alert,
        score,
        matchedStationCount: matched.length,
        severity: severityLabel(score),
      } as RankedTransitAlert;
    })
    .sort((a, b) => b.score - a.score);
}
