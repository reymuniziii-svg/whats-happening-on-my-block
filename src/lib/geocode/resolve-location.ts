import type { ResolvedLocation } from "@/types/brief";
import { memoryCache } from "@/lib/cache/memory-cache";
import { geoclientIsConfigured, geoclientResolveAddress, geoclientResolveBbl } from "@/lib/geocode/geoclient";
import { geosearchResolve } from "@/lib/geocode/geosearch";

export interface ResolveLocationInput {
  address?: string;
  bbl?: string;
}

function normalizeBorough(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed
    .split(" ")
    .map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

// Address/BBL → location is stable, so cache resolved locations (Redis-backed when
// configured) to avoid repeat geocoder round-trips — including the sequential GeoSearch
// fallback on a Geoclient miss. Failures throw out of the loader and are not cached.
const LOCATION_CACHE_TTL_SECONDS = 604_800; // 7 days

export async function resolveLocation(input: ResolveLocationInput): Promise<ResolvedLocation> {
  if (!input.address && !input.bbl) {
    throw new Error("Either address or bbl is required");
  }

  const cacheKey = input.bbl
    ? `location:bbl:${input.bbl.replace(/\D/g, "")}`
    : `location:addr:${(input.address ?? "").trim().toLowerCase()}`;

  return memoryCache.getOrSet(cacheKey, LOCATION_CACHE_TTL_SECONDS, () => resolveLocationUncached(input));
}

async function resolveLocationUncached(input: ResolveLocationInput): Promise<ResolvedLocation> {
  let resolved: ResolvedLocation | null = null;

  if (input.bbl) {
    resolved = await geoclientResolveBbl(input.bbl);
    if (!resolved) {
      resolved = await geosearchResolve(input.bbl);
    }
  } else if (input.address) {
    resolved = await geoclientResolveAddress(input.address);
    if (!resolved) {
      resolved = await geosearchResolve(input.address);
    }
  }

  if (!resolved) {
    const modeHint = geoclientIsConfigured() ? "geoclient+fallback" : "fallback";
    throw new Error(`Unable to resolve location with ${modeHint}`);
  }

  return {
    ...resolved,
    borough: normalizeBorough(resolved.borough),
  };
}
