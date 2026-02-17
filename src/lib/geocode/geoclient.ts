import type { ResolvedLocation } from "@/types/brief";

const GEOCLIENT_BASE = "https://api.nyc.gov/geo/geoclient/v2";

function geoclientCredentials() {
  const appId = process.env.GEOCLIENT_APP_ID;
  const appKey = process.env.GEOCLIENT_APP_KEY;
  if (!appId || !appKey) {
    return null;
  }
  return { appId, appKey };
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function firstDefined<T>(...values: Array<T | undefined | null>): T | undefined {
  return values.find((value): value is T => value !== undefined && value !== null);
}

function parseGeoclientObject(obj: Record<string, unknown>, fallbackAddress: string): ResolvedLocation | null {
  const latValue = toNumber(firstDefined(obj.latitude, obj.lat, obj.yCoordinate));
  const lonValue = toNumber(firstDefined(obj.longitude, obj.lon, obj.xCoordinate));

  if (!Number.isFinite(latValue) || !Number.isFinite(lonValue)) {
    return null;
  }

  const lat = latValue as number;
  const lon = lonValue as number;

  const houseNumber = firstDefined(obj.houseNumber, obj.house_number);
  const firstStreet = firstDefined(obj.firstStreetNameNormalized, obj.firstStreetName, obj.streetName);
  const borough = firstDefined(obj.borough, obj.firstBoroughName, obj.uspsPreferredCityName);

  const normalized = [houseNumber, firstStreet].filter(Boolean).join(" ").trim();

  return {
    normalized_address: normalized || fallbackAddress,
    geocoder: "geoclient",
    confidence: toNumber(obj.confidence),
    lat,
    lon,
    bbl: firstDefined(obj.bbl, obj.bblNumber)?.toString(),
    bin: firstDefined(obj.buildingIdentificationNumber, obj.bin)?.toString(),
    borough: borough?.toString(),
    community_district: firstDefined(obj.communityDistrict, obj.communitydistrict)?.toString(),
    council_district: firstDefined(obj.cityCouncilDistrict, obj.councilDistrict)?.toString(),
    zip_code: firstDefined(obj.zipCode, obj.zip)?.toString(),
  };
}

export async function geoclientResolveAddress(address: string): Promise<ResolvedLocation | null> {
  const creds = geoclientCredentials();
  if (!creds) {
    return null;
  }

  const url = `${GEOCLIENT_BASE}/search.json?input=${encodeURIComponent(address)}&app_id=${encodeURIComponent(
    creds.appId,
  )}&app_key=${encodeURIComponent(creds.appKey)}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const json = (await response.json()) as {
    results?: Array<{ response?: Record<string, unknown> }>;
    response?: Record<string, unknown>;
  };

  if (json.results?.length) {
    for (const item of json.results) {
      if (item.response) {
        const parsed = parseGeoclientObject(item.response, address);
        if (parsed) {
          return parsed;
        }
      }
    }
  }

  if (json.response) {
    return parseGeoclientObject(json.response, address);
  }

  return null;
}

const BOROUGH_BY_DIGIT: Record<string, string> = {
  "1": "manhattan",
  "2": "bronx",
  "3": "brooklyn",
  "4": "queens",
  "5": "staten island",
};

export async function geoclientResolveBbl(bbl: string): Promise<ResolvedLocation | null> {
  const creds = geoclientCredentials();
  if (!creds) {
    return null;
  }

  const cleaned = bbl.replace(/\D/g, "");
  if (cleaned.length !== 10) {
    return null;
  }

  const boroughDigit = cleaned[0];
  const borough = BOROUGH_BY_DIGIT[boroughDigit];
  if (!borough) {
    return null;
  }

  const block = cleaned.slice(1, 6);
  const lot = cleaned.slice(6);

  const url = `${GEOCLIENT_BASE}/bbl.json?borough=${encodeURIComponent(borough)}&block=${block}&lot=${lot}&app_id=${encodeURIComponent(
    creds.appId,
  )}&app_key=${encodeURIComponent(creds.appKey)}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const json = (await response.json()) as {
    bbl?: Record<string, unknown>;
    response?: Record<string, unknown>;
  };

  const payload = json.bbl ?? json.response;
  if (!payload) {
    return null;
  }

  return parseGeoclientObject(payload, bbl);
}

export function geoclientIsConfigured(): boolean {
  return Boolean(geoclientCredentials());
}
