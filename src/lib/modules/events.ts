import { memoryCache } from "@/lib/cache/memory-cache";
import { sodaFetch } from "@/lib/soda/client";
import { andClauses, betweenIso, boroughPredicate } from "@/lib/soda/query-builders";
import { daysAheadIso } from "@/lib/utils/time";
import type { Module } from "@/types/brief";
import type { ModuleBuildContext, ModuleBuilder } from "@/lib/modules/types";
import { moduleSkeleton, moduleSources, unavailableModule } from "@/lib/modules/helpers";

interface EventRow {
  event_id?: string;
  event_name?: string;
  event_type?: string;
  event_location?: string;
  event_borough?: string;
  start_date_time?: string;
  end_date_time?: string;
  community_board?: string;
}

function normalizeCommunityDistrict(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  return value.replace(/\D/g, "") || undefined;
}

export async function buildEventsModule(context: ModuleBuildContext): Promise<Module> {
  const sources = moduleSources(["tvpp-9vvx"]);
  const methodology = "next 30 days; borough-filtered with community-board fallback when available";

  try {
    const windowEnd = daysAheadIso(30);
    const boroughClause = boroughPredicate("event_borough", context.location.borough);
    const where = andClauses(
      betweenIso("start_date_time", context.nowIso, windowEnd),
      boroughClause,
      "event_name is not null",
    );

    const cacheKey = `tvpp-9vvx:${context.blockKey}:${context.nowIso.slice(0, 10)}`;
    const rows = await memoryCache.getOrSet(cacheKey, 1800, () =>
      sodaFetch<EventRow>("tvpp-9vvx", {
        select:
          "event_id, event_name, event_type, event_location, event_borough, start_date_time, end_date_time, community_board",
        where,
        order: "start_date_time ASC",
        limit: 80,
      }),
    );

    const cd = normalizeCommunityDistrict(context.location.community_district);
    const filtered = cd
      ? rows.filter((row) => {
          const board = normalizeCommunityDistrict(row.community_board);
          return !board || board === cd;
        })
      : rows;

    const candidateRows = filtered.length ? filtered : rows;
    const nextEvent = candidateRows[0];

    const moduleCard = moduleSkeleton(
      "events",
      candidateRows.length
        ? `${candidateRows.length} permitted events are scheduled in the next 30 days for this area.`
        : "No upcoming permitted events were found for this area in the next 30 days.",
      sources,
      methodology,
      "ok",
    );

    moduleCard.stats = [
      { label: "Upcoming events", value: candidateRows.length },
      { label: "Next event", value: nextEvent?.event_name ?? "None" },
      { label: "Starts", value: nextEvent?.start_date_time ? new Date(nextEvent.start_date_time).toLocaleDateString("en-US") : "N/A" },
    ];

    moduleCard.items = candidateRows.slice(0, 12).map((row) => ({
      title: row.event_name || "Permitted event",
      subtitle: row.event_type,
      date_start: row.start_date_time,
      date_end: row.end_date_time,
      location_desc: row.event_location,
      source_dataset_id: "tvpp-9vvx",
      raw_id: row.event_id,
    }));

    if (!cd) {
      moduleCard.coverage_note =
        "This module uses borough-level filtering because community district metadata was not available for the query.";
    }

    return moduleCard;
  } catch (error) {
    return unavailableModule(
      "events",
      "Events data is temporarily unavailable.",
      sources,
      methodology,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}

export const eventsModule: ModuleBuilder = {
  id: "events",
  build: buildEventsModule,
};
