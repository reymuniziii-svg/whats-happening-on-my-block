import { Buffer } from "node:buffer";
import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import { logger } from "@/lib/observability/logger";

export interface TransitAlert {
  id: string;
  headline: string;
  description?: string;
  effect?: string;
  cause?: string;
  stop_ids: string[];
  route_ids: string[];
  starts_at_utc?: string;
  ends_at_utc?: string;
}

function textFromTranslation(
  message?: { translation?: Array<{ text?: string | null } | null> | null } | null,
): string | undefined {
  if (!message?.translation?.length) {
    return undefined;
  }
  return message.translation.find((entry) => entry?.text?.trim())?.text?.trim();
}

function isoFromEpoch(value?: unknown): string | undefined {
  if (typeof value !== "number") {
    return undefined;
  }
  const date = new Date(value * 1000);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function toFeedUrls(): string[] {
  const configured = process.env.MTA_SERVICE_ALERTS_URL?.trim();
  if (configured) {
    return configured
      .split(",")
      .map((url) => url.trim())
      .filter(Boolean);
  }

  return [
    "https://api.mta.info/gtfs-rt/service-alerts",
    "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/camsys%2Fall-alerts",
  ];
}

async function fetchFeed(url: string, apiKey?: string): Promise<Uint8Array> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

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
      throw new Error(`MTA alerts fetch failed (${response.status})`);
    }

    return new Uint8Array(await response.arrayBuffer());
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeAlerts(feed: GtfsRealtimeBindings.transit_realtime.IFeedMessage): TransitAlert[] {
  const entities = feed.entity ?? [];
  const alerts: TransitAlert[] = [];

  for (const entity of entities) {
    const alert = entity.alert;
    if (!alert) {
      continue;
    }

    const informed = alert.informedEntity ?? [];
    const stopIds = informed
      .map((item) => item.stopId)
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0);

    const routeIds = informed
      .map((item) => item.routeId)
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0);

    const firstPeriod = alert.activePeriod?.[0];
    alerts.push({
      id: entity.id || `alert-${alerts.length + 1}`,
      headline: textFromTranslation(alert.headerText) || "Transit service alert",
      description: textFromTranslation(alert.descriptionText),
      effect: alert.effect !== undefined ? String(alert.effect) : undefined,
      cause: alert.cause !== undefined ? String(alert.cause) : undefined,
      stop_ids: [...new Set(stopIds)],
      route_ids: [...new Set(routeIds)],
      starts_at_utc: isoFromEpoch(firstPeriod?.start),
      ends_at_utc: isoFromEpoch(firstPeriod?.end),
    });
  }

  return alerts;
}

export async function fetchTransitAlerts(): Promise<{ alerts: TransitAlert[]; sourceUrl?: string }> {
  const apiKey = process.env.MTA_API_KEY?.trim();
  const urls = toFeedUrls();
  let lastError: Error | null = null;

  for (const url of urls) {
    try {
      const payload = await fetchFeed(url, apiKey);
      const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(Buffer.from(payload));
      return { alerts: normalizeAlerts(feed), sourceUrl: url };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("unknown transit alert fetch error");
      logger.warn({ url, error: lastError.message }, "failed to fetch transit alert feed url");
    }
  }

  if (lastError) {
    throw lastError;
  }

  return { alerts: [] };
}
