import { checkRateLimit } from "@/lib/ratelimit/memory-rate-limit";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

interface GeoSearchAutocompleteResponse {
  features?: Array<{
    geometry?: { coordinates?: [number, number] };
    properties?: {
      id?: string;
      gid?: string;
      label?: string;
      layer?: string;
      borough?: string;
      postalcode?: string;
    };
  }>;
}

function clientKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown-client";
}

export async function GET(request: NextRequest) {
  const limit = checkRateLimit(`autocomplete:${clientKey(request)}`);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", suggestions: [] },
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

  const text = request.nextUrl.searchParams.get("text")?.trim() ?? "";
  if (text.length < 3) {
    return NextResponse.json({ suggestions: [] });
  }

  const requestedLimit = Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "6", 10);
  const safeLimit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 10)
    : 6;

  try {
    const url = `https://geosearch.planninglabs.nyc/v2/autocomplete?text=${encodeURIComponent(text)}&size=${safeLimit}`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
      cache: "force-cache",
      next: {
        revalidate: 86400,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { suggestions: [], error: `GeoSearch autocomplete failed (${response.status})` },
        { status: 502 },
      );
    }

    const json = (await response.json()) as GeoSearchAutocompleteResponse;
    const suggestions = (json.features ?? [])
      .map((feature, index) => {
        const lat = feature.geometry?.coordinates?.[1];
        const lon = feature.geometry?.coordinates?.[0];
        const label = feature.properties?.label?.trim();

        if (!label || !Number.isFinite(lat) || !Number.isFinite(lon)) {
          return null;
        }

        const fallbackId = `${label}:${lat}:${lon}:${index}`;
        return {
          id: feature.properties?.gid ?? feature.properties?.id ?? fallbackId,
          label,
          layer: feature.properties?.layer,
          borough: feature.properties?.borough,
          zip_code: feature.properties?.postalcode,
          lat: lat as number,
          lon: lon as number,
        };
      })
      .filter((item) => item !== null)
      .slice(0, safeLimit);

    return NextResponse.json(
      { suggestions },
      {
        headers: {
          "Cache-Control": "s-maxage=300, stale-while-revalidate=86400",
        },
      },
    );
  } catch {
    return NextResponse.json({ suggestions: [], error: "Autocomplete unavailable" }, { status: 502 });
  }
}
