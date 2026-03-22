import { redisEnabled } from "@/lib/cache/redis-cache";
import { metricsSnapshot } from "@/lib/observability/metrics";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "whats-happening-on-my-block",
    timestamp_utc: new Date().toISOString(),
    cache_backend: redisEnabled() ? "redis+memory" : "memory",
    metrics: metricsSnapshot(),
  });
}
