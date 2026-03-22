import { memoryCache } from "@/lib/cache/memory-cache";
import { buildBriefV2 } from "@/lib/brief/build-brief-v2";
import { encodeBlockId } from "@/lib/brief/share-id";
import { resolveLocation } from "@/lib/geocode/resolve-location";
import { logger } from "@/lib/observability/logger";
import { recordRouteTiming } from "@/lib/observability/metrics";
import { requestIdFromRequest, withRequestIdHeader } from "@/lib/observability/request-id";
import { checkRateLimit } from "@/lib/ratelimit/memory-rate-limit";
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
    namespace: "v2-brief",
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
    const cacheKey = `brief:v2:${blockId}`;

    const response = await memoryCache.getOrSet(cacheKey, 900, () =>
      buildBriefV2({
        location,
        rawAddress: address || bbl || undefined,
      }),
    );

    return NextResponse.json(
      {
        block_id: blockId,
        share_path: `/b/${blockId}`,
        ...response,
      },
      {
        headers: withRequestIdHeader(requestId, {
          "Cache-Control": "s-maxage=300, stale-while-revalidate=600",
        }),
      },
    );
  } catch (error) {
    logger.error({ request_id: requestId, error }, "v2 brief route failed");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to build v2 brief" },
      { status: 500, headers: withRequestIdHeader(requestId) },
    );
  } finally {
    recordRouteTiming("/api/v2/brief", Date.now() - startedAt);
  }
}
