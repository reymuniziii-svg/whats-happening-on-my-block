import { buildBriefV2 } from "@/lib/brief/build-brief-v2";
import { decodeBlockId } from "@/lib/brief/share-id";
import { findModule, summaryMetrics, topModuleItems } from "@/lib/brief/summary-metrics";
import { checkRateLimit } from "@/lib/ratelimit/memory-rate-limit";
import { logger } from "@/lib/observability/logger";
import { recordRouteTiming } from "@/lib/observability/metrics";
import { requestIdFromRequest, withRequestIdHeader } from "@/lib/observability/request-id";
import type { ResolvedLocation } from "@/types/brief";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

function clientKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown-client";
}

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{ block_id: string }>;
  },
) {
  const startedAt = Date.now();
  const requestId = requestIdFromRequest(request);

  const limit = await checkRateLimit(`v2-widget:${clientKey(request)}`, {
    namespace: "v2-widget",
    maxRequests: 30,
    windowMs: 60_000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: withRequestIdHeader(
          requestId,
          limit.retryAfterSeconds
            ? {
                "Retry-After": String(limit.retryAfterSeconds),
              }
            : undefined,
        ),
      },
    );
  }

  try {
    const { block_id } = await context.params;
    const payload = decodeBlockId(block_id);

    const location: ResolvedLocation = {
      normalized_address: payload.normalized_address ?? `${payload.lat}, ${payload.lon}`,
      geocoder: "geosearch",
      confidence: undefined,
      lat: payload.lat,
      lon: payload.lon,
      bbl: payload.bbl,
      bin: payload.bin,
      borough: payload.borough,
      community_district: payload.community_district,
      council_district: payload.council_district,
      zip_code: payload.zip_code,
    };

    const { brief, module_freshness } = await buildBriefV2({ location });
    const metrics = summaryMetrics(brief);

    return NextResponse.json(
      {
        version: "2",
        block_id,
        address: brief.input.normalized_address,
        updated_at_utc: brief.updated_at_utc,
        share_url: `/b/${block_id}`,
        embed_url: `/embed/${block_id}`,
        metrics: {
          active_disruptions: metrics.activeDisruptions,
          crashes_90d: metrics.crashes90d,
          injuries_90d: metrics.injuries90d,
          requests_30d: metrics.requests30d,
          upcoming_events_30d: metrics.upcomingEvents,
        },
        highlights: {
          right_now: topModuleItems(findModule(brief, "right_now"), 3),
          top_311_types: topModuleItems(findModule(brief, "311_pulse"), 3),
        },
        module_freshness,
      },
      {
        headers: withRequestIdHeader(requestId, {
          "Cache-Control": "s-maxage=300, stale-while-revalidate=600",
        }),
      },
    );
  } catch (error) {
    logger.warn({ request_id: requestId, error }, "v2 widget route failed");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to build widget payload" },
      { status: 400, headers: withRequestIdHeader(requestId) },
    );
  } finally {
    recordRouteTiming("/api/v2/widget/[block_id]", Date.now() - startedAt);
  }
}
