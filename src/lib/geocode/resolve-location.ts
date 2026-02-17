import type { ResolvedLocation } from "@/types/brief";
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

export async function resolveLocation(input: ResolveLocationInput): Promise<ResolvedLocation> {
  if (!input.address && !input.bbl) {
    throw new Error("Either address or bbl is required");
  }

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
