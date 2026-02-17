import { memoryCache } from "@/lib/cache/memory-cache";
import { sodaFetch } from "@/lib/soda/client";
import { andClauses, betweenIso, boroughPredicate, pointInPolygon } from "@/lib/soda/query-builders";
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
  street_closure_type?: string;
  community_board?: string;
}

interface CommunityDistrictRow {
  boro_cd?: string;
}

interface EventSignalRow {
  row: EventRow;
  board?: string;
  score: number;
  hasClosureSignal: boolean;
  hasStreetSignal: boolean;
  isRoutineSports: boolean;
  communityMatch: boolean;
}

const LOCATION_STOPWORDS = new Set([
  "STREET",
  "ST",
  "AVENUE",
  "AVE",
  "ROAD",
  "RD",
  "BOULEVARD",
  "BLVD",
  "PLACE",
  "PL",
  "NORTH",
  "SOUTH",
  "EAST",
  "WEST",
  "BROOKLYN",
  "MANHATTAN",
  "BRONX",
  "QUEENS",
  "STATEN",
  "ISLAND",
]);

function normalizeCommunityDistrict(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const digits = value.replace(/\D/g, "");
  if (!digits) {
    return undefined;
  }
  if (digits.length >= 3) {
    return digits.slice(-2).padStart(2, "0");
  }
  return digits.padStart(2, "0");
}

function fromBoroCd(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return String(Math.floor(parsed) % 100).padStart(2, "0");
}

function extractStreetTokens(normalizedAddress?: string): string[] {
  if (!normalizedAddress) {
    return [];
  }
  const [streetPart] = normalizedAddress.split(",");
  if (!streetPart) {
    return [];
  }

  return streetPart
    .replace(/^\s*\d+\s+/, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .toUpperCase()
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3 && !LOCATION_STOPWORDS.has(part))
    .slice(0, 3);
}

function parseTimeValue(value?: string): number {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function hasStreetClosureSignal(row: EventRow): boolean {
  const closure = row.street_closure_type?.trim();
  return Boolean(closure && closure.toUpperCase() !== "N/A");
}

function isRoutineSportsEvent(row: EventRow): boolean {
  return (row.event_type ?? "").toLowerCase().includes("sport");
}

function hasStreetTokenSignal(location: string | undefined, tokens: string[]): boolean {
  if (!location || !tokens.length) {
    return false;
  }
  const upper = location.toUpperCase();
  return tokens.some((token) => upper.includes(token));
}

async function resolveCommunityDistrict(context: ModuleBuildContext): Promise<{ district?: string; source: "geocoder" | "boundary_lookup" | "none" }> {
  const geocoderCd = normalizeCommunityDistrict(context.location.community_district);
  if (geocoderCd) {
    return { district: geocoderCd, source: "geocoder" };
  }

  const lookupKey = `events:community-district:${context.blockKey}`;
  const lookedUp = await memoryCache.getOrSet(lookupKey, 86_400, async () => {
    const where = pointInPolygon("the_geom", context.location.lon, context.location.lat);
    const rows = await sodaFetch<CommunityDistrictRow>(
      "5crt-au7u",
      {
        select: "boro_cd",
        where,
        limit: 1,
      },
      { cacheSeconds: 86_400 },
    );
    return fromBoroCd(rows[0]?.boro_cd);
  });

  if (lookedUp) {
    return { district: lookedUp, source: "boundary_lookup" };
  }

  return { district: undefined, source: "none" };
}

export async function buildEventsModule(context: ModuleBuildContext): Promise<Module> {
  const sources = moduleSources(["tvpp-9vvx", "5crt-au7u"]);
  const methodology =
    "next 30 days; borough filter plus local relevance scoring (community district match, street-closure signal, nearby street-text signal), with boundary-based community district lookup when geocoder metadata is missing";

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
          "event_id, event_name, event_type, event_location, event_borough, start_date_time, end_date_time, street_closure_type, community_board",
        where,
        limit: 250,
      }),
    );

    const communityDistrict = await resolveCommunityDistrict(context);
    const streetTokens = extractStreetTokens(context.location.normalized_address);

    const scoredRows: EventSignalRow[] = rows.map((row) => {
      const board = normalizeCommunityDistrict(row.community_board);
      const communityMatch = Boolean(communityDistrict.district && board === communityDistrict.district);
      const hasClosureSignal = hasStreetClosureSignal(row);
      const hasStreetSignal = hasStreetTokenSignal(row.event_location, streetTokens);
      const isRoutineSports = isRoutineSportsEvent(row);

      let score = 0;
      if (communityMatch) {
        score += 5;
      }
      if (hasClosureSignal) {
        score += 3;
      }
      if (hasStreetSignal) {
        score += 2;
      }
      if (!isRoutineSports) {
        score += 1;
      }

      return {
        row,
        board,
        score,
        hasClosureSignal,
        hasStreetSignal,
        isRoutineSports,
        communityMatch,
      };
    });

    const communityScopedRows =
      communityDistrict.district
        ? scoredRows.filter((entry) => entry.communityMatch)
        : [];

    let localPool = communityScopedRows.length ? communityScopedRows : scoredRows;

    if (localPool.length > 30) {
      const relevanceTrim = localPool.filter((entry) => entry.hasClosureSignal || entry.hasStreetSignal || !entry.isRoutineSports);
      if (relevanceTrim.length >= 8) {
        localPool = relevanceTrim;
      }
    }

    const rankedRows = [...localPool].sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return parseTimeValue(a.row.start_date_time) - parseTimeValue(b.row.start_date_time);
    });

    const candidateRows = rankedRows.map((entry) => entry.row);
    const nextEvent = candidateRows[0];

    const moduleCard = moduleSkeleton(
      "events",
      candidateRows.length
        ? `${candidateRows.length} locally relevant permitted events are scheduled in the next 30 days.`
        : "No upcoming permitted events were found for this area in the next 30 days.",
      sources,
      methodology,
      "ok",
    );

    moduleCard.stats = [
      { label: "Upcoming events", value: candidateRows.length },
      { label: "Next event", value: nextEvent?.event_name ?? "None" },
      { label: "Starts", value: nextEvent?.start_date_time ? new Date(nextEvent.start_date_time).toLocaleDateString("en-US") : "N/A" },
      {
        label: "Local filter",
        value: communityDistrict.district ? `Borough + CD ${communityDistrict.district}` : "Borough + relevance",
      },
    ];

    moduleCard.items = candidateRows.slice(0, 12).map((row) => ({
      title: row.event_name || "Permitted event",
      subtitle:
        [row.event_type, hasStreetClosureSignal(row) ? `Closure: ${row.street_closure_type}` : undefined]
          .filter(Boolean)
          .join(" · ") || undefined,
      date_start: row.start_date_time,
      date_end: row.end_date_time,
      location_desc: row.event_location,
      source_dataset_id: "tvpp-9vvx",
      raw_id: row.event_id,
    }));

    if (communityDistrict.source === "boundary_lookup") {
      moduleCard.coverage_note =
        `Community district was derived from point-in-polygon lookup (5crt-au7u) to reduce borough-wide event noise. Showing ${candidateRows.length} of ${rows.length} borough events after local relevance filtering.`;
    } else if (communityDistrict.source === "none") {
      moduleCard.coverage_note =
        `Community district metadata was unavailable, so this module uses borough scope plus relevance ranking. Showing ${candidateRows.length} of ${rows.length} borough events.`;
    } else {
      moduleCard.coverage_note = `Showing ${candidateRows.length} of ${rows.length} borough events after local relevance filtering.`;
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
