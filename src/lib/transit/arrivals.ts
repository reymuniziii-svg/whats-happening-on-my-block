import { Buffer } from "node:buffer";
import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import { logger } from "@/lib/observability/logger";

export interface StopTimeUpdate {
  stopId: string;
  arrivalTime?: Date;
  departureTime?: Date;
  delay?: number;
}

export interface TripArrival {
  tripId: string;
  routeId: string;
  direction?: string;
  stopUpdates: StopTimeUpdate[];
}

export interface ArrivalPrediction {
  stopId: string;
  routeId: string;
  tripId: string;
  arrivalTime: Date;
  minutesAway: number;
  direction?: string;
}

const MTA_TRIP_UPDATE_FEEDS = [
  "https://api.mta.info/gtfs-rt/tripUpdates/ace",
  "https://api.mta.info/gtfs-rt/tripUpdates/bdfm",
  "https://api.mta.info/gtfs-rt/tripUpdates/g",
  "https://api.mta.info/gtfs-rt/tripUpdates/jz",
  "https://api.mta.info/gtfs-rt/tripUpdates/l",
  "https://api.mta.info/gtfs-rt/tripUpdates/nqrw",
  "https://api.mta.info/gtfs-rt/tripUpdates/123456",
  "https://api.mta.info/gtfs-rt/tripUpdates/7",
  "https://api.mta.info/gtfs-rt/tripUpdates/sir",
];

async function fetchFeed(url: string, apiKey?: string): Promise<Uint8Array | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6_000);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/x-protobuf",
        ...(apiKey ? { "x-api-key": apiKey } : {}),
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      logger.warn({ url, status: response.status }, "MTA trip updates fetch failed");
      return null;
    }

    return new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    logger.warn(
      { url, error: error instanceof Error ? error.message : "unknown" },
      "MTA trip updates fetch error",
    );
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function parseStopTimeUpdate(
  stu: GtfsRealtimeBindings.transit_realtime.TripUpdate.IStopTimeUpdate,
): StopTimeUpdate | null {
  const stopId = stu.stopId;
  if (!stopId) {
    return null;
  }

  const arrivalTime = stu.arrival?.time
    ? new Date(Number(stu.arrival.time) * 1000)
    : undefined;
  const departureTime = stu.departure?.time
    ? new Date(Number(stu.departure.time) * 1000)
    : undefined;
  const delay = stu.arrival?.delay ?? stu.departure?.delay ?? undefined;

  return {
    stopId,
    arrivalTime,
    departureTime,
    delay: typeof delay === "number" ? delay : undefined,
  };
}

function parseTripUpdates(
  feed: GtfsRealtimeBindings.transit_realtime.IFeedMessage,
): TripArrival[] {
  const entities = feed.entity ?? [];
  const trips: TripArrival[] = [];

  for (const entity of entities) {
    const tripUpdate = entity.tripUpdate;
    if (!tripUpdate) {
      continue;
    }

    const tripId = tripUpdate.trip?.tripId;
    const routeId = tripUpdate.trip?.routeId;
    if (!tripId || !routeId) {
      continue;
    }

    const stopUpdates = (tripUpdate.stopTimeUpdate ?? [])
      .map(parseStopTimeUpdate)
      .filter((update): update is StopTimeUpdate => update !== null);

    if (stopUpdates.length === 0) {
      continue;
    }

    const directionId = tripUpdate.trip?.directionId;
    trips.push({
      tripId,
      routeId,
      direction: directionId === 0 ? "uptown" : directionId === 1 ? "downtown" : undefined,
      stopUpdates,
    });
  }

  return trips;
}

export async function fetchArrivalsForStops(
  stopIds: string[],
  options: { maxMinutesAhead?: number } = {},
): Promise<ArrivalPrediction[]> {
  const maxMinutesAhead = options.maxMinutesAhead ?? 30;
  const apiKey = process.env.MTA_API_KEY?.trim();
  const now = Date.now();
  const maxArrivalTime = now + maxMinutesAhead * 60 * 1000;

  const normalizedStopIds = new Set<string>();

  for (const stopId of stopIds) {
    normalizedStopIds.add(stopId);
    // MTA stop IDs often have direction suffixes (N/S)
    if (stopId.length > 1) {
      normalizedStopIds.add(stopId + "N");
      normalizedStopIds.add(stopId + "S");
      // Remove suffix if present for matching
      if (stopId.endsWith("N") || stopId.endsWith("S")) {
        normalizedStopIds.add(stopId.slice(0, -1));
      }
    }
  }

  const allArrivals: ArrivalPrediction[] = [];

  const feedPromises = MTA_TRIP_UPDATE_FEEDS.map(async (url) => {
    const payload = await fetchFeed(url, apiKey);
    if (!payload) {
      return [];
    }

    try {
      const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
        Buffer.from(payload),
      );
      const trips = parseTripUpdates(feed);
      const arrivals: ArrivalPrediction[] = [];

      for (const trip of trips) {
        for (const stopUpdate of trip.stopUpdates) {
          if (!normalizedStopIds.has(stopUpdate.stopId)) {
            continue;
          }

          const arrivalTime = stopUpdate.arrivalTime ?? stopUpdate.departureTime;
          if (!arrivalTime) {
            continue;
          }

          const arrivalMs = arrivalTime.getTime();
          if (arrivalMs < now || arrivalMs > maxArrivalTime) {
            continue;
          }

          arrivals.push({
            stopId: stopUpdate.stopId,
            routeId: trip.routeId,
            tripId: trip.tripId,
            arrivalTime,
            minutesAway: Math.round((arrivalMs - now) / 60_000),
            direction: trip.direction,
          });
        }
      }

      return arrivals;
    } catch (error) {
      logger.warn(
        { url, error: error instanceof Error ? error.message : "unknown" },
        "Failed to parse trip update feed",
      );
      return [];
    }
  });

  const results = await Promise.allSettled(feedPromises);

  for (const result of results) {
    if (result.status === "fulfilled") {
      allArrivals.push(...result.value);
    }
  }

  // Sort by arrival time and dedupe by tripId+stopId
  const seen = new Set<string>();
  return allArrivals
    .sort((a, b) => a.arrivalTime.getTime() - b.arrivalTime.getTime())
    .filter((arrival) => {
      const key = `${arrival.tripId}:${arrival.stopId}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

export async function fetchNearbyArrivals(
  stopIds: string[],
  options: { limit?: number; maxMinutesAhead?: number } = {},
): Promise<{ arrivals: ArrivalPrediction[]; fetchedAt: string }> {
  const limit = options.limit ?? 8;
  const arrivals = await fetchArrivalsForStops(stopIds, options);

  return {
    arrivals: arrivals.slice(0, limit),
    fetchedAt: new Date().toISOString(),
  };
}
