import { memoryCache } from "@/lib/cache/memory-cache";
import { sodaFetch } from "@/lib/soda/client";
import { andClauses, boroughPredicate, compareIso, withinCircle } from "@/lib/soda/query-builders";
import { distancePointToLineMeters, parseWktLineStringToLatLon } from "@/lib/utils/geo";
import type { Module } from "@/types/brief";
import type { ModuleBuildContext, ModuleBuilder } from "@/lib/modules/types";
import { moduleSkeleton, moduleSources, unavailableModule } from "@/lib/modules/helpers";

interface ActiveClosureRow {
  uniqueid?: string;
  onstreetname?: string;
  fromstreetname?: string;
  tostreetname?: string;
  work_start_date?: string;
  work_end_date?: string;
  purpose?: string;
}

interface ActiveWorkRow {
  permitnumber?: string;
  permittypedesc?: string;
  permitteename?: string;
  onstreetname?: string;
  fromstreetname?: string;
  tostreetname?: string;
  issuedworkstartdate?: string;
  issuedworkenddate?: string;
  wkt?: string;
}

interface ActiveFilmRow {
  eventid?: string;
  eventtype?: string;
  parkingheld?: string;
  startdatetime?: string;
  enddatetime?: string;
  zipcode_s?: string;
}

function nowBounds(nowIso: string): { now: string } {
  return { now: nowIso };
}

function zipMatches(zips: string | undefined, zip?: string): boolean {
  if (!zip || !zips) {
    return true;
  }
  return zips
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .includes(zip);
}

export async function buildRightNowModule(context: ModuleBuildContext): Promise<Module> {
  const sources = moduleSources(["i6b5-j7bu", "tqtj-sjs8", "tg4x-b46p"]);
  const methodology =
    "active-now strip built from live time overlap checks; closures use geospatial radius, street works use WKT proximity, film uses borough+ZIP fallback";

  try {
    const { now } = nowBounds(context.nowIso);

    const closureWhere = andClauses(
      withinCircle("the_geom", context.location.lat, context.location.lon, context.radiusSecondaryM),
      compareIso("work_start_date", "<=", now),
      compareIso("work_end_date", ">=", now),
    );

    const workWhere = andClauses(
      boroughPredicate("boroughname", context.location.borough),
      compareIso("issuedworkstartdate", "<=", now),
      compareIso("issuedworkenddate", ">=", now),
      "wkt is not null",
    );

    const filmWhere = andClauses(
      boroughPredicate("borough", context.location.borough),
      compareIso("startdatetime", "<=", now),
      compareIso("enddatetime", ">=", now),
    );

    const [closureRows, workRows, filmRows] = await Promise.all([
      memoryCache.getOrSet(`rightnow:i6b5:${context.blockKey}:${now.slice(0, 13)}`, 900, () =>
        sodaFetch<ActiveClosureRow>("i6b5-j7bu", {
          select: "uniqueid, onstreetname, fromstreetname, tostreetname, work_start_date, work_end_date, purpose",
          where: closureWhere,
          order: "work_end_date ASC",
          limit: 20,
        }),
      ),
      memoryCache.getOrSet(`rightnow:tqtj:${context.blockKey}:${now.slice(0, 13)}`, 900, () =>
        sodaFetch<ActiveWorkRow>("tqtj-sjs8", {
          select:
            "permitnumber, permittypedesc, permitteename, onstreetname, fromstreetname, tostreetname, issuedworkstartdate, issuedworkenddate, wkt",
          where: workWhere,
          order: "issuedworkenddate ASC",
          limit: 500,
        }),
      ),
      memoryCache.getOrSet(`rightnow:film:${context.blockKey}:${now.slice(0, 13)}`, 1800, () =>
        sodaFetch<ActiveFilmRow>("tg4x-b46p", {
          select: "eventid, eventtype, parkingheld, startdatetime, enddatetime, zipcode_s",
          where: filmWhere,
          order: "enddatetime ASC",
          limit: 60,
        }),
      ),
    ]);

    const nearbyWorks = workRows.filter((row) => {
      if (!row.wkt) {
        return false;
      }
      const line = parseWktLineStringToLatLon(row.wkt);
      if (!line.length) {
        return false;
      }
      const distance = distancePointToLineMeters(context.location.lat, context.location.lon, line);
      return distance <= context.radiusSecondaryM;
    });

    const nearbyFilm = filmRows.filter((row) => zipMatches(row.zipcode_s, context.location.zip_code));

    const moduleCard = moduleSkeleton(
      "right_now",
      closureRows.length + nearbyWorks.length + nearbyFilm.length > 0
        ? `Right now: ${closureRows.length} active closures, ${nearbyWorks.length} active street works, and ${nearbyFilm.length} active film permits nearby.`
        : "Right now: no active closures, film permits, or street works were detected nearby.",
      sources,
      methodology,
      "ok",
    );

    moduleCard.stats = [
      { label: "Active closures", value: closureRows.length },
      { label: "Active street works", value: nearbyWorks.length },
      { label: "Active film permits", value: nearbyFilm.length },
    ];

    moduleCard.items = [
      ...closureRows.slice(0, 5).map((row) => ({
        title: [row.onstreetname, row.fromstreetname && row.tostreetname ? `(${row.fromstreetname} to ${row.tostreetname})` : ""]
          .filter(Boolean)
          .join(" "),
        subtitle: row.purpose,
        date_start: row.work_start_date,
        date_end: row.work_end_date,
        location_desc: [row.onstreetname, row.fromstreetname, row.tostreetname].filter(Boolean).join(" / "),
        source_dataset_id: "i6b5-j7bu" as const,
        raw_id: row.uniqueid,
      })),
      ...nearbyWorks.slice(0, 5).map((row) => ({
        title: row.permittypedesc || "Street work",
        subtitle: row.permitteename,
        date_start: row.issuedworkstartdate,
        date_end: row.issuedworkenddate,
        location_desc: [row.onstreetname, row.fromstreetname, row.tostreetname].filter(Boolean).join(" / "),
        source_dataset_id: "tqtj-sjs8" as const,
        raw_id: row.permitnumber,
        geometry_wkt: row.wkt,
      })),
      ...nearbyFilm.slice(0, 5).map((row) => ({
        title: row.eventtype || "Film permit",
        subtitle: row.parkingheld,
        date_start: row.startdatetime,
        date_end: row.enddatetime,
        location_desc: row.parkingheld,
        source_dataset_id: "tg4x-b46p" as const,
        raw_id: row.eventid,
      })),
    ].slice(0, 12);

    if (!context.location.zip_code) {
      moduleCard.coverage_note = "Film matching is borough-level because ZIP metadata was unavailable for this location.";
    }

    return moduleCard;
  } catch (error) {
    return unavailableModule(
      "right_now",
      "Live disruption strip is temporarily unavailable.",
      sources,
      methodology,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}

export const rightNowModule: ModuleBuilder = {
  id: "right_now",
  build: buildRightNowModule,
};
