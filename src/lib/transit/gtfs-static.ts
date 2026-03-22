import stopsSnapshot from "@/lib/transit/stops.snapshot.json";
import { haversineMeters } from "@/lib/utils/geo";

export interface TransitStop {
  stop_id: string;
  stop_name: string;
  stop_lat: number;
  stop_lon: number;
  location_type: number;
  parent_station?: string;
  borough?: string;
}

export interface NearbyTransitStation {
  station_id: string;
  station_name: string;
  lat: number;
  lon: number;
  distance_m: number;
  borough?: string;
  aliases: string[];
}

function stationKey(stop: TransitStop): string {
  return stop.parent_station || stop.stop_id;
}

function stationName(stop: TransitStop): string {
  if (stop.location_type === 1) {
    return stop.stop_name;
  }
  return stop.parent_station || stop.stop_name;
}

export function nearbyTransitStations(
  lat: number,
  lon: number,
  options: { limit?: number; radiusMeters?: number } = {},
): NearbyTransitStation[] {
  const limit = options.limit ?? 6;
  const radiusMeters = options.radiusMeters ?? 1200;

  const grouped = new Map<string, NearbyTransitStation>();

  for (const stop of stopsSnapshot as TransitStop[]) {
    const distance = haversineMeters(lat, lon, stop.stop_lat, stop.stop_lon);
    if (distance > radiusMeters) {
      continue;
    }

    const key = stationKey(stop);
    const existing = grouped.get(key);

    if (!existing || distance < existing.distance_m) {
      grouped.set(key, {
        station_id: key,
        station_name: stationName(stop),
        lat: stop.stop_lat,
        lon: stop.stop_lon,
        distance_m: distance,
        borough: stop.borough,
        aliases: [stop.stop_id, ...(stop.parent_station ? [stop.parent_station] : [])],
      });
    } else {
      existing.aliases.push(stop.stop_id);
      grouped.set(key, existing);
    }
  }

  return [...grouped.values()]
    .map((item) => ({
      ...item,
      aliases: [...new Set(item.aliases)],
    }))
    .sort((a, b) => a.distance_m - b.distance_m)
    .slice(0, limit);
}
