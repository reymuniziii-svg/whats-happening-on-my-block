import { memoryCache } from "@/lib/cache/memory-cache";
import { fetchTransitAlerts } from "@/lib/transit/alerts";
import { nearbyTransitStations } from "@/lib/transit/gtfs-static";
import { rankTransitAlerts } from "@/lib/transit/scoring";
import type { Module } from "@/types/brief";
import type { ModuleBuildContext, ModuleBuilder } from "@/lib/modules/types";
import { moduleSkeleton, moduleSources, unavailableModule } from "@/lib/modules/helpers";

function nearestStationLabel(station?: { station_name: string; distance_m: number }): string {
  if (!station) {
    return "N/A";
  }
  const rounded = Math.round(station.distance_m / 10) * 10;
  return `${station.station_name} (${rounded}m)`;
}

export async function buildTransitMobilityModule(context: ModuleBuildContext): Promise<Module> {
  const sources = moduleSources(["mta-gtfs-stops-snapshot", "mta-service-alerts-gtfs-rt"]);
  const methodology =
    "nearest transit stations are calculated from GTFS stop snapshot within 1200m; service alerts are fetched from MTA GTFS-RT and ranked by local stop match + severity + timing";

  try {
    const stations = nearbyTransitStations(context.location.lat, context.location.lon, {
      limit: 6,
      radiusMeters: 1200,
    });

    const alertsCacheKey = `transit-alerts:${context.nowIso.slice(0, 16)}`;
    const alertResult = await memoryCache.getOrSet(alertsCacheKey, 300, () => fetchTransitAlerts());
    const rankedAlerts = rankTransitAlerts(alertResult.alerts, stations, context.nowIso);

    const localAlerts = rankedAlerts.filter((entry) => entry.matchedStationCount > 0).slice(0, 12);
    const highImpact = localAlerts.filter((entry) => entry.severity === "high").length;

    const moduleCard = moduleSkeleton(
      "transit_mobility",
      stations.length
        ? `${stations.length} nearby transit stations found; ${localAlerts.length} locally relevant service alerts right now.`
        : "No nearby transit stations found in the current radius.",
      sources,
      methodology,
      "ok",
    );

    moduleCard.stats = [
      { label: "Nearby stations", value: stations.length },
      { label: "Local alerts", value: localAlerts.length },
      { label: "High impact alerts", value: highImpact },
      { label: "Nearest station", value: nearestStationLabel(stations[0]) },
    ];

    const stationItems = stations.slice(0, 4).map((station) => ({
      title: station.station_name,
      subtitle: `${Math.round(station.distance_m)}m away`,
      location_desc: station.borough,
      source_dataset_id: "mta-gtfs-stops-snapshot" as const,
      raw_id: station.station_id,
      lat: station.lat,
      lon: station.lon,
    }));

    const alertItems = localAlerts.slice(0, 8).map((entry) => ({
      title: entry.alert.headline,
      subtitle: `${entry.severity.toUpperCase()} impact • score ${entry.score}`,
      date_start: entry.alert.starts_at_utc,
      date_end: entry.alert.ends_at_utc,
      source_dataset_id: "mta-service-alerts-gtfs-rt" as const,
      raw_id: entry.alert.id,
    }));

    moduleCard.items = [...stationItems, ...alertItems].slice(0, 12);

    if (alertResult.sourceUrl) {
      moduleCard.coverage_note = `Alerts source: ${alertResult.sourceUrl}`;
    }

    if (stations.length === 0) {
      moduleCard.status = "partial";
      moduleCard.warnings = ["No nearby GTFS stations in snapshot radius."];
    }

    return moduleCard;
  } catch (error) {
    return unavailableModule(
      "transit_mobility",
      "Transit and mobility signals are temporarily unavailable.",
      sources,
      methodology,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}

export const transitMobilityModule: ModuleBuilder = {
  id: "transit_mobility",
  build: buildTransitMobilityModule,
};
