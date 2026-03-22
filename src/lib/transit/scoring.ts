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

function severityWeight(alert: TransitAlert): number {
  const effect = (alert.effect ?? "").toLowerCase();

  if (effect.includes("3") || effect.includes("4") || effect.includes("10") || effect.includes("no_service")) {
    return 7;
  }

  if (effect.includes("2") || effect.includes("6") || effect.includes("reduced_service") || effect.includes("detour")) {
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
