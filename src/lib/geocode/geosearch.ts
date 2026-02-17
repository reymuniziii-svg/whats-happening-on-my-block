import type { ResolvedLocation } from "@/types/brief";

interface GeoSearchResponse {
  features?: Array<{
    geometry?: { coordinates?: [number, number] };
    properties?: {
      label?: string;
      confidence?: number;
      borough?: string;
      postalcode?: string;
      addendum?: {
        pad?: {
          bbl?: string;
          bin?: string;
        };
      };
    };
  }>;
}

export async function geosearchResolve(text: string): Promise<ResolvedLocation | null> {
  const url = `https://geosearch.planninglabs.nyc/v2/search?text=${encodeURIComponent(text)}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const json = (await response.json()) as GeoSearchResponse;
  const first = json.features?.[0];
  const latValue = first?.geometry?.coordinates?.[1];
  const lonValue = first?.geometry?.coordinates?.[0];

  if (!Number.isFinite(latValue) || !Number.isFinite(lonValue)) {
    return null;
  }

  const lat = latValue as number;
  const lon = lonValue as number;

  return {
    normalized_address: first?.properties?.label ?? text,
    geocoder: "geosearch",
    confidence: first?.properties?.confidence,
    lat,
    lon,
    bbl: first?.properties?.addendum?.pad?.bbl,
    bin: first?.properties?.addendum?.pad?.bin,
    borough: first?.properties?.borough,
    zip_code: first?.properties?.postalcode,
  };
}
