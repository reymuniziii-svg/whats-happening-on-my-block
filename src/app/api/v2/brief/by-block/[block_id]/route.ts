import { memoryCache } from "@/lib/cache/memory-cache";
import { buildBriefV2 } from "@/lib/brief/build-brief-v2";
import { decodeBlockId } from "@/lib/brief/share-id";
import { logger } from "@/lib/observability/logger";
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

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{ block_id: string }>;
  },
) {
  const requestId = requestIdFromRequest(request);

  const limit = await checkRateLimit(clientKey(request), {
    namespace: "v2-brief-by-block",
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

    const cacheKey = `brief:v2:${block_id}`;
    const response = await memoryCache.getOrSet(cacheKey, 900, () => buildBriefV2({ location }));

    return NextResponse.json(
      {
        block_id,
        share_path: `/b/${block_id}`,
        ...response,
      },
      {
        headers: withRequestIdHeader(requestId, {
          "Cache-Control": "s-maxage=300, stale-while-revalidate=600",
        }),
      },
    );
  } catch (error) {
    logger.warn({ request_id: requestId, error }, "v2 by-block route failed");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to decode block id" },
      { status: 400, headers: withRequestIdHeader(requestId) },
    );
  }
}
