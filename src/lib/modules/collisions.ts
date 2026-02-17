import { memoryCache } from "@/lib/cache/memory-cache";
import { sodaFetch } from "@/lib/soda/client";
import { andClauses, betweenIso, withinCircle } from "@/lib/soda/query-builders";
import { haversineMeters } from "@/lib/utils/geo";
import type { Module } from "@/types/brief";
import type { ModuleBuildContext, ModuleBuilder } from "@/lib/modules/types";
import { moduleSkeleton, moduleSources, toNumber, unavailableModule } from "@/lib/modules/helpers";

interface CollisionAggregateRow {
  crashes: string;
  injuries: string;
}

interface CollisionRow {
  collision_id?: string;
  crash_date?: string;
  on_street_name?: string;
  cross_street_name?: string;
  off_street_name?: string;
  latitude?: string;
  longitude?: string;
  number_of_persons_injured?: string;
}

interface Cluster {
  points: Array<{ lat: number; lon: number; label: string }>;
  centerLat: number;
  centerLon: number;
}

function clusterCollisions(rows: CollisionRow[], clusterRadiusM: number): Cluster[] {
  const clusters: Cluster[] = [];

  for (const row of rows) {
    const lat = Number(row.latitude);
    const lon = Number(row.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      continue;
    }

    const label = [row.on_street_name, row.cross_street_name ?? row.off_street_name]
      .filter(Boolean)
      .join(" & ");

    let attached = false;
    for (const cluster of clusters) {
      const distance = haversineMeters(lat, lon, cluster.centerLat, cluster.centerLon);
      if (distance <= clusterRadiusM) {
        cluster.points.push({ lat, lon, label });
        const latAvg = cluster.points.reduce((sum, p) => sum + p.lat, 0) / cluster.points.length;
        const lonAvg = cluster.points.reduce((sum, p) => sum + p.lon, 0) / cluster.points.length;
        cluster.centerLat = latAvg;
        cluster.centerLon = lonAvg;
        attached = true;
        break;
      }
    }

    if (!attached) {
      clusters.push({
        points: [{ lat, lon, label }],
        centerLat: lat,
        centerLon: lon,
      });
    }
  }

  return clusters;
}

function topIntersectionLabel(cluster: Cluster): string {
  const counts = new Map<string, number>();
  for (const point of cluster.points) {
    const label = point.label || "Unnamed intersection";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  let winner = "No hotspot";
  let max = 0;
  for (const [label, count] of counts) {
    if (count > max) {
      winner = label;
      max = count;
    }
  }
  return winner;
}

export async function buildCollisionsModule(context: ModuleBuildContext): Promise<Module> {
  const sources = moduleSources(["h9gi-nx95"]);
  const methodology = `within ${context.radiusSecondaryM}m; last 90 days; clusters by 75m for hotspot`;

  try {
    const where = andClauses(
      withinCircle("location", context.location.lat, context.location.lon, context.radiusSecondaryM),
      betweenIso("crash_date", context.window90dIso),
      "latitude is not null",
      "longitude is not null",
    );

    const aggregateKey = `h9gi-nx95:${context.blockKey}:agg:${context.window90dIso}`;
    const rowsKey = `h9gi-nx95:${context.blockKey}:rows:${context.window90dIso}`;

    const [aggregateRows, detailRows] = await Promise.all([
      memoryCache.getOrSet(aggregateKey, 900, () =>
        sodaFetch<CollisionAggregateRow>("h9gi-nx95", {
          select: "count(*) as crashes, sum(number_of_persons_injured) as injuries",
          where,
          limit: 1,
        }),
      ),
      memoryCache.getOrSet(rowsKey, 900, () =>
        sodaFetch<CollisionRow>("h9gi-nx95", {
          select:
            "collision_id, crash_date, on_street_name, cross_street_name, off_street_name, latitude, longitude, number_of_persons_injured",
          where,
          order: "crash_date DESC",
          limit: 300,
        }),
      ),
    ]);

    const aggregate = aggregateRows[0];
    const crashes = toNumber(aggregate?.crashes);
    const injuries = toNumber(aggregate?.injuries);

    const clusters = clusterCollisions(detailRows, 75).sort((a, b) => b.points.length - a.points.length);
    const hotspot = clusters[0];
    const hotspotLabel = hotspot ? topIntersectionLabel(hotspot) : "No hotspot";
    const hotspotCount = hotspot ? hotspot.points.length : 0;

    const moduleCard = moduleSkeleton(
      "collisions",
      crashes > 0
        ? `${crashes} crashes reported nearby in the last 90 days, including ${injuries} injuries.`
        : "No recent crashes were found in this radius during the last 90 days.",
      sources,
      methodology,
      "ok",
    );

    moduleCard.stats = [
      { label: "Crashes (90d)", value: crashes },
      { label: "Injuries (90d)", value: injuries },
      { label: "Hot intersection", value: hotspotLabel },
      { label: "Hotspot crashes", value: hotspotCount },
    ];

    moduleCard.items = detailRows
      .sort((a, b) => toNumber(b.number_of_persons_injured) - toNumber(a.number_of_persons_injured))
      .slice(0, 12)
      .map((row) => ({
        title:
          [row.on_street_name, row.cross_street_name ?? row.off_street_name].filter(Boolean).join(" & ") ||
          "Collision record",
        subtitle: `${toNumber(row.number_of_persons_injured)} injuries`,
        date_start: row.crash_date,
        location_desc:
          [row.on_street_name, row.cross_street_name ?? row.off_street_name].filter(Boolean).join(" & ") || undefined,
        source_dataset_id: "h9gi-nx95",
        raw_id: row.collision_id,
        lat: Number(row.latitude),
        lon: Number(row.longitude),
      }));

    return moduleCard;
  } catch (error) {
    return unavailableModule(
      "collisions",
      "Collision data is temporarily unavailable.",
      sources,
      methodology,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}

export const collisionsModule: ModuleBuilder = {
  id: "collisions",
  build: buildCollisionsModule,
};
