import { memoryCache } from "@/lib/cache/memory-cache";
import { buildBrief } from "@/lib/brief/build-brief";
import { encodeBlockId } from "@/lib/brief/share-id";
import { resolveLocation } from "@/lib/geocode/resolve-location";
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

function toBlockId(location: ResolvedLocation): string {
  return encodeBlockId({
    lat: location.lat,
    lon: location.lon,
    bbl: location.bbl,
    bin: location.bin,
    borough: location.borough,
    normalized_address: location.normalized_address,
    community_district: location.community_district,
    council_district: location.council_district,
    zip_code: location.zip_code,
  });
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const requestId = requestIdFromRequest(request);

  const limit = await checkRateLimit(clientKey(request), {
    namespace: "brief",
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

  const { searchParams } = request.nextUrl;
  const address = searchParams.get("address")?.trim();
  const bbl = searchParams.get("bbl")?.trim();

  if (!address && !bbl) {
    return NextResponse.json({ error: "Provide address or bbl." }, { status: 400, headers: withRequestIdHeader(requestId) });
  }

  try {
    const location = await resolveLocation({
      address: address || undefined,
      bbl: bbl || undefined,
    });

    const blockId = toBlockId(location);
    const cacheKey = `brief:${blockId}`;

    const brief = await memoryCache.getOrSet(cacheKey, 900, () =>
      buildBrief({
        location,
        rawAddress: address || bbl || undefined,
      }),
    );

    return NextResponse.json({
      block_id: blockId,
      share_path: `/b/${blockId}`,
      brief,
      _deprecation: "This v1 endpoint is deprecated. Please migrate to /api/v2/brief for module freshness metadata.",
    }, {
      headers: withRequestIdHeader(requestId, {
        "Cache-Control": "s-maxage=300, stale-while-revalidate=600",
        "Deprecation": "true",
        "Sunset": "2026-06-01",
        "Link": "</api/v2/brief>; rel=\"successor-version\"",
      }),
    });
  } catch (error) {
    logger.error({ request_id: requestId, error }, "brief route failed");
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to build brief",
      },
      { status: 500, headers: withRequestIdHeader(requestId) },
    );
  } finally {
    recordRouteTiming("/api/brief", Date.now() - startedAt);
  }
}
