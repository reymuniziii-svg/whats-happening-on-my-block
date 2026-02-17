import { memoryCache } from "@/lib/cache/memory-cache";
import { sodaFetch } from "@/lib/soda/client";
import { andClauses, betweenIso, boroughPredicate, compareIso, withinCircle } from "@/lib/soda/query-builders";
import { distancePointToLineMeters, parseWktLineStringToLatLon } from "@/lib/utils/geo";
import { daysAheadIso, durationDays } from "@/lib/utils/time";
import type { Module } from "@/types/brief";
import type { ModuleBuildContext, ModuleBuilder } from "@/lib/modules/types";
import { moduleSkeleton, moduleSources, unavailableModule } from "@/lib/modules/helpers";

interface StreetClosureRow {
  uniqueid?: string;
  onstreetname?: string;
  fromstreetname?: string;
  tostreetname?: string;
  work_start_date?: string;
  work_end_date?: string;
  purpose?: string;
}

interface StreetPermitRow {
  permitnumber?: string;
  permitstatusshortdesc?: string;
  permittypedesc?: string;
  permitteename?: string;
  onstreetname?: string;
  fromstreetname?: string;
  tostreetname?: string;
  issuedworkstartdate?: string;
  issuedworkenddate?: string;
  wkt?: string;
}

interface OpeningPermitRow {
  permitnumber?: string;
  permittypedesc?: string;
  permitstatusshortdesc?: string;
  permitteename?: string;
  onstreetname?: string;
  fromstreetname?: string;
  tostreetname?: string;
  issuedworkstartdate?: string;
  issuedworkenddate?: string;
}

function isActiveNow(start?: string, end?: string, nowIso?: string): boolean {
  if (!start || !end || !nowIso) {
    return false;
  }
  const now = new Date(nowIso).getTime();
  const startTs = new Date(start).getTime();
  const endTs = new Date(end).getTime();
  if (Number.isNaN(now) || Number.isNaN(startTs) || Number.isNaN(endTs)) {
    return false;
  }
  return now >= startTs && now <= endTs;
}

function rankStreetWorks(rows: StreetPermitRow[], nowIso: string) {
  return [...rows].sort((a, b) => {
    const aActive = isActiveNow(a.issuedworkstartdate, a.issuedworkenddate, nowIso) ? 1 : 0;
    const bActive = isActiveNow(b.issuedworkstartdate, b.issuedworkenddate, nowIso) ? 1 : 0;
    if (aActive !== bActive) {
      return bActive - aActive;
    }

    const aDuration = durationDays(a.issuedworkstartdate, a.issuedworkenddate);
    const bDuration = durationDays(b.issuedworkstartdate, b.issuedworkenddate);
    return bDuration - aDuration;
  });
}

export async function buildStreetWorksModule(context: ModuleBuildContext): Promise<Module> {
  const sources = moduleSources(["tqtj-sjs8", "9jic-byiu", "i6b5-j7bu"]);
  const methodology =
    "active-first ranking: active now, then longer duration, then closer geometry; closure radius is geospatial, opening permits use borough+street fallback";

  try {
    const next30 = daysAheadIso(30);

    const closuresWhere = andClauses(
      withinCircle("the_geom", context.location.lat, context.location.lon, context.radiusSecondaryM),
      betweenIso("work_end_date", context.nowIso),
    );

    const permitsWhere = andClauses(
      boroughPredicate("boroughname", context.location.borough),
      compareIso("issuedworkenddate", ">=", context.window90dIso),
      compareIso("issuedworkstartdate", "<=", next30),
      "wkt is not null",
    );

    const openingWhere = andClauses(
      boroughPredicate("boroughname", context.location.borough),
      compareIso("issuedworkenddate", ">=", context.window90dIso),
      compareIso("issuedworkstartdate", "<=", next30),
    );

    const [closureRows, permitRows, openingRows] = await Promise.all([
      memoryCache.getOrSet(`i6b5-j7bu:${context.blockKey}:${context.nowIso.slice(0, 10)}`, 900, () =>
        sodaFetch<StreetClosureRow>("i6b5-j7bu", {
          select:
            "uniqueid, onstreetname, fromstreetname, tostreetname, work_start_date, work_end_date, purpose",
          where: closuresWhere,
          order: "work_start_date ASC",
          limit: 80,
        }),
      ),
      memoryCache.getOrSet(`tqtj-sjs8:${context.blockKey}:${context.nowIso.slice(0, 10)}`, 900, () =>
        sodaFetch<StreetPermitRow>("tqtj-sjs8", {
          select:
            "permitnumber, permitstatusshortdesc, permittypedesc, permitteename, onstreetname, fromstreetname, tostreetname, issuedworkstartdate, issuedworkenddate, wkt",
          where: permitsWhere,
          order: "issuedworkstartdate ASC",
          limit: 1200,
        }),
      ),
      memoryCache.getOrSet(`9jic-byiu:${context.blockKey}:${context.nowIso.slice(0, 10)}`, 900, () =>
        sodaFetch<OpeningPermitRow>("9jic-byiu", {
          select:
            "permitnumber, permittypedesc, permitstatusshortdesc, permitteename, onstreetname, fromstreetname, tostreetname, issuedworkstartdate, issuedworkenddate",
          where: openingWhere,
          order: "issuedworkstartdate ASC",
          limit: 250,
        }),
      ),
    ]);

    const nearbyPermits = permitRows
      .map((row) => {
        const line = row.wkt ? parseWktLineStringToLatLon(row.wkt) : [];
        const proximity = line.length
          ? distancePointToLineMeters(context.location.lat, context.location.lon, line)
          : Number.POSITIVE_INFINITY;
        return {
          row,
          proximity,
        };
      })
      .filter((entry) => entry.proximity <= context.radiusSecondaryM)
      .sort((a, b) => a.proximity - b.proximity)
      .map((entry) => entry.row);

    const rankedPermits = rankStreetWorks(nearbyPermits, context.nowIso);
    const activeStreetWorks = rankedPermits.filter((row) => isActiveNow(row.issuedworkstartdate, row.issuedworkenddate, context.nowIso));
    const activeClosures = closureRows.filter((row) => isActiveNow(row.work_start_date, row.work_end_date, context.nowIso));

    const permitteeCounts = new Map<string, number>();
    for (const permit of rankedPermits) {
      const name = permit.permitteename?.trim();
      if (!name) {
        continue;
      }
      permitteeCounts.set(name, (permitteeCounts.get(name) ?? 0) + 1);
    }

    const topPermittees = [...permitteeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => `${name} (${count})`)
      .join(", ");

    const mostDisruptive = rankedPermits[0];

    const moduleCard = moduleSkeleton(
      "street_works",
      activeStreetWorks.length + activeClosures.length > 0
        ? `${activeStreetWorks.length + activeClosures.length} active street disruptions are currently in effect nearby.`
        : "No active street disruptions were found in the immediate radius right now.",
      sources,
      methodology,
      "ok",
    );

    moduleCard.stats = [
      { label: "Active street works", value: activeStreetWorks.length },
      { label: "Active closures", value: activeClosures.length },
      { label: "Most disruptive", value: mostDisruptive?.permittypedesc ?? "N/A" },
      { label: "Top permittees", value: topPermittees || "N/A" },
    ];

    moduleCard.items = [
      ...activeClosures.slice(0, 5).map((row) => ({
        title:
          [row.onstreetname, row.fromstreetname && row.tostreetname ? `(${row.fromstreetname} to ${row.tostreetname})` : ""]
            .filter(Boolean)
            .join(" ") || "Street closure",
        subtitle: row.purpose,
        date_start: row.work_start_date,
        date_end: row.work_end_date,
        location_desc: [row.onstreetname, row.fromstreetname, row.tostreetname].filter(Boolean).join(" / "),
        source_dataset_id: "i6b5-j7bu",
        raw_id: row.uniqueid,
      })),
      ...rankedPermits.slice(0, 5).map((row) => ({
        title: row.permittypedesc || "Street work permit",
        subtitle: row.permitteename,
        date_start: row.issuedworkstartdate,
        date_end: row.issuedworkenddate,
        location_desc: [row.onstreetname, row.fromstreetname, row.tostreetname].filter(Boolean).join(" / "),
        source_dataset_id: "tqtj-sjs8",
        raw_id: row.permitnumber,
        geometry_wkt: row.wkt,
      })),
      ...openingRows.slice(0, 2).map((row) => ({
        title: row.permittypedesc || "Street opening permit",
        subtitle: `${row.permitteename ?? "Unknown permittee"} · ${row.permitstatusshortdesc ?? "Unknown status"}`,
        date_start: row.issuedworkstartdate,
        date_end: row.issuedworkenddate,
        location_desc: [row.onstreetname, row.fromstreetname, row.tostreetname].filter(Boolean).join(" / "),
        source_dataset_id: "9jic-byiu",
        raw_id: row.permitnumber,
      })),
    ].slice(0, 12);

    moduleCard.coverage_note =
      "Street opening permits (9jic-byiu) are borough-filtered in v1 because precise geometry is not consistently exposed in this feed.";

    return moduleCard;
  } catch (error) {
    return unavailableModule(
      "street_works",
      "Street works data is temporarily unavailable.",
      sources,
      methodology,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}

export const streetWorksModule: ModuleBuilder = {
  id: "street_works",
  build: buildStreetWorksModule,
};
