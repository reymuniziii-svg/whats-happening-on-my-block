import { listWatchlistBlocks } from "@/lib/watchlist/service";
import { applyWatchlistCookie, watchlistSessionFromRequest } from "@/lib/watchlist/session";
import { checkRateLimit } from "@/lib/ratelimit/memory-rate-limit";
import { requestIdFromRequest, withRequestIdHeader } from "@/lib/observability/request-id";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

function clientKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown-client";
}

export async function GET(request: NextRequest) {
  const requestId = requestIdFromRequest(request);
  const session = watchlistSessionFromRequest(request);

  const limit = await checkRateLimit(`watchlist:${session.sessionId || clientKey(request)}`, {
    namespace: "watchlist-read",
    maxRequests: 60,
    windowMs: 60_000,
  });

  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: withRequestIdHeader(
          requestId,
          limit.retryAfterSeconds ? { "Retry-After": String(limit.retryAfterSeconds) } : undefined,
        ),
      },
    );
  }

  const blocks = await listWatchlistBlocks(session.sessionId);
  const response = NextResponse.json(
    {
      session_id: session.sessionId,
      blocks,
    },
    {
      headers: withRequestIdHeader(requestId),
    },
  );

  applyWatchlistCookie(response, session);
  return response;
}
