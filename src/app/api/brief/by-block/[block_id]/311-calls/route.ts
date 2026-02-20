import { DATASETS } from "@/config/datasets";
import { DEFAULT_PARAMETERS } from "@/config/modules";
import { decodeBlockId } from "@/lib/brief/share-id";
import { memoryCache } from "@/lib/cache/memory-cache";
import { checkRateLimit } from "@/lib/ratelimit/memory-rate-limit";
import { sodaFetch } from "@/lib/soda/client";
import { andClauses, betweenIso, withinCircle } from "@/lib/soda/query-builders";
import { nowUtcIso } from "@/lib/utils/time";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

interface CountRow {
  count?: string;
}

interface CallsRow {
  unique_key?: string;
  created_date?: string;
  closed_date?: string;
  complaint_type?: string;
  descriptor?: string;
  status?: string;
  incident_address?: string;
  street_name?: string;
  cross_street_1?: string;
  cross_street_2?: string;
}

interface CallItem {
  id: string;
  title: string;
  subtitle?: string;
  status?: string;
  date_start?: string;
  date_end?: string;
  location_desc?: string;
}

function clientKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown-client";
}

function clampInteger(value: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
}

function toNumber(value?: string): number {
  if (!value) {
    return 0;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toIsoOrUndefined(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed.toISOString();
}

function locationFromRow(row: CallsRow): string | undefined {
  const direct = row.incident_address?.trim();
  if (direct) {
    return direct;
  }

  const street = row.street_name?.trim();
  const crossOne = row.cross_street_1?.trim();
  const crossTwo = row.cross_street_2?.trim();

  if (street && crossOne) {
    return `${street} & ${crossOne}`;
  }
  if (crossOne && crossTwo) {
    return `${crossOne} & ${crossTwo}`;
  }
  return street || crossOne || crossTwo || undefined;
}

function toCallItem(row: CallsRow, index: number): CallItem {
  const title = row.complaint_type?.trim() || "Unknown complaint";
  const descriptor = row.descriptor?.trim();
  const status = row.status?.trim();

  const subtitleParts = [descriptor, status ? `Status: ${status}` : undefined].filter(Boolean) as string[];

  return {
    id: row.unique_key?.trim() || `${title}:${row.created_date ?? index}`,
    title,
    subtitle: subtitleParts.join(" • ") || undefined,
    status: status || undefined,
    date_start: toIsoOrUndefined(row.created_date),
    date_end: toIsoOrUndefined(row.closed_date),
    location_desc: locationFromRow(row),
  };
}

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{ block_id: string }>;
  },
) {
  const limit = checkRateLimit(`311-calls:${clientKey(request)}`);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", calls: [] },
      {
        status: 429,
        headers: limit.retryAfterSeconds
          ? {
              "Retry-After": String(limit.retryAfterSeconds),
            }
          : undefined,
      },
    );
  }

  try {
    const { block_id } = await context.params;
    const payload = decodeBlockId(block_id);

    const days = clampInteger(request.nextUrl.searchParams.get("days"), 30, 1, 90);
    const rowLimit = clampInteger(request.nextUrl.searchParams.get("limit"), 500, 50, 1000);
    const radiusM = DEFAULT_PARAMETERS.radius_secondary_m;

    const start = new Date();
    start.setUTCDate(start.getUTCDate() - days);
    const startIso = start.toISOString();

    const where = andClauses(
      withinCircle("location", payload.lat, payload.lon, radiusM),
      betweenIso("created_date", startIso),
    );

    const dataset = DATASETS["erm2-nwe9"];
    const countCacheKey = `erm2-nwe9:all311:count:${block_id}:${days}:v1`;
    const rowsCacheKey = `erm2-nwe9:all311:rows:${block_id}:${days}:${rowLimit}:v1`;

    const [countRows, rows] = await Promise.all([
      memoryCache.getOrSet(countCacheKey, 900, () =>
        sodaFetch<CountRow>("erm2-nwe9", {
          select: "count(*) as count",
          where,
          limit: 1,
        }),
      ),
      memoryCache.getOrSet(rowsCacheKey, 900, () =>
        sodaFetch<CallsRow>("erm2-nwe9", {
          select:
            "unique_key, created_date, closed_date, complaint_type, descriptor, status, incident_address, street_name, cross_street_1, cross_street_2",
          where,
          order: "created_date::floating_timestamp DESC",
          limit: rowLimit,
        }),
      ),
    ]);

    const totalCalls = toNumber(countRows[0]?.count);
    const calls = rows.map(toCallItem);

    return NextResponse.json(
      {
        total_calls: totalCalls,
        returned_calls: calls.length,
        truncated: totalCalls > calls.length,
        window_days: days,
        radius_m: radiusM,
        generated_at_utc: nowUtcIso(),
        methodology: `within ${radiusM}m; last ${days} days; sorted newest first`,
        source: {
          dataset_id: dataset.id,
          dataset_name: dataset.name,
          dataset_url: dataset.url,
        },
        calls,
      },
      {
        headers: {
          "Cache-Control": "s-maxage=120, stale-while-revalidate=600",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load 311 calls", calls: [] },
      { status: 400 },
    );
  }
}
