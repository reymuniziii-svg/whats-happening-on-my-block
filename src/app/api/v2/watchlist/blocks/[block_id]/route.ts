import { removeWatchlistBlock } from "@/lib/watchlist/service";
import { applyWatchlistCookie, watchlistSessionFromRequest } from "@/lib/watchlist/session";
import { checkRateLimit } from "@/lib/ratelimit/memory-rate-limit";
import { requestIdFromRequest, withRequestIdHeader } from "@/lib/observability/request-id";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function DELETE(
  request: NextRequest,
  context: {
    params: Promise<{ block_id: string }>;
  },
) {
  const requestId = requestIdFromRequest(request);
  const session = watchlistSessionFromRequest(request);

  const limit = await checkRateLimit(`watchlist-mutate:${session.sessionId}`, {
    namespace: "watchlist-write",
    maxRequests: 20,
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

  const { block_id } = await context.params;
  const blocks = await removeWatchlistBlock(session.sessionId, block_id);

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
