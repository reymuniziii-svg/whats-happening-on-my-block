import { memoryCache } from "@/lib/cache/memory-cache";
import { buildBrief } from "@/lib/brief/build-brief";
import { decodeBlockId } from "@/lib/brief/share-id";
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
  const limit = checkRateLimit(clientKey(request));
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
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

    const cacheKey = `brief:${block_id}`;
    const brief = await memoryCache.getOrSet(cacheKey, 900, () =>
      buildBrief({
        location,
      }),
    );

    return NextResponse.json({
      block_id,
      share_path: `/b/${block_id}`,
      brief,
    }, {
      headers: {
        "Cache-Control": "s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to decode block id",
      },
      { status: 400 },
    );
  }
}
