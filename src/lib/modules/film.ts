import { memoryCache } from "@/lib/cache/memory-cache";
import { sodaFetch } from "@/lib/soda/client";
import { andClauses, betweenIso, boroughPredicate } from "@/lib/soda/query-builders";
import { daysAheadIso } from "@/lib/utils/time";
import type { Module } from "@/types/brief";
import type { ModuleBuildContext, ModuleBuilder } from "@/lib/modules/types";
import { moduleSkeleton, moduleSources, unavailableModule } from "@/lib/modules/helpers";

interface FilmRow {
  eventid?: string;
  category?: string;
  subcategoryname?: string;
  borough?: string;
  zipcode_s?: string;
  parkingheld?: string;
  startdatetime?: string;
  enddatetime?: string;
  eventtype?: string;
}

function zipListIncludes(zips: string | undefined, zip?: string): boolean {
  if (!zip || !zips) {
    return true;
  }
  return zips
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .includes(zip);
}

export async function buildFilmModule(context: ModuleBuildContext): Promise<Module> {
  const sources = moduleSources(["tg4x-b46p"]);
  const methodology = "next 30 days and active-now check; borough + ZIP fallback matching";

  try {
    const windowEnd = daysAheadIso(30);
    const where = andClauses(
      betweenIso("startdatetime", context.nowIso, windowEnd),
      boroughPredicate("borough", context.location.borough),
    );

    const cacheKey = `tg4x-b46p:${context.blockKey}:${context.nowIso.slice(0, 10)}`;
    const rows = await memoryCache.getOrSet(cacheKey, 1800, () =>
      sodaFetch<FilmRow>("tg4x-b46p", {
        select:
          "eventid, category, subcategoryname, borough, zipcode_s, parkingheld, startdatetime, enddatetime, eventtype",
        where,
        order: "startdatetime ASC",
        limit: 100,
      }),
    );

    const filtered = rows.filter((row) => zipListIncludes(row.zipcode_s, context.location.zip_code));
    const candidateRows = filtered.length ? filtered : rows;

    const now = new Date(context.nowIso).getTime();
    const activeCount = candidateRows.filter((row) => {
      const start = row.startdatetime ? new Date(row.startdatetime).getTime() : Number.POSITIVE_INFINITY;
      const end = row.enddatetime ? new Date(row.enddatetime).getTime() : Number.NEGATIVE_INFINITY;
      return now >= start && now <= end;
    }).length;

    const moduleCard = moduleSkeleton(
      "film",
      candidateRows.length
        ? `${candidateRows.length} film permits are scheduled nearby in the next 30 days.`
        : "No upcoming film permits were found in this area for the next 30 days.",
      sources,
      methodology,
      "ok",
    );

    moduleCard.stats = [
      { label: "Upcoming permits", value: candidateRows.length },
      { label: "Active now", value: activeCount },
      { label: "Area filter", value: context.location.zip_code ? `ZIP ${context.location.zip_code}` : "Borough" },
    ];

    moduleCard.items = candidateRows.slice(0, 12).map((row) => ({
      title: row.eventtype || row.category || "Film permit",
      subtitle: row.subcategoryname,
      date_start: row.startdatetime,
      date_end: row.enddatetime,
      location_desc: row.parkingheld,
      source_dataset_id: "tg4x-b46p",
      raw_id: row.eventid,
    }));

    if (!context.location.zip_code) {
      moduleCard.coverage_note = "ZIP metadata was unavailable, so this module is borough-scoped in v1.";
    }

    return moduleCard;
  } catch (error) {
    return unavailableModule(
      "film",
      "Film permit data is temporarily unavailable.",
      sources,
      methodology,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}

export const filmModule: ModuleBuilder = {
  id: "film",
  build: buildFilmModule,
};
