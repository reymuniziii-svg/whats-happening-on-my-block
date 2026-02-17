import { memoryCache } from "@/lib/cache/memory-cache";
import { buildBrief } from "@/lib/brief/build-brief";
import { encodeBlockId } from "@/lib/brief/share-id";
import { resolveLocation } from "@/lib/geocode/resolve-location";
import { checkRateLimit } from "@/lib/ratelimit/memory-rate-limit";
import type { ResolvedLocation } from "@/types/brief";
import { NextRequest, NextResponse } from "next/server";

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

  const { searchParams } = request.nextUrl;
  const address = searchParams.get("address")?.trim();
  const bbl = searchParams.get("bbl")?.trim();

  if (!address && !bbl) {
    return NextResponse.json({ error: "Provide address or bbl." }, { status: 400 });
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
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to build brief",
      },
      { status: 500 },
    );
  }
}
