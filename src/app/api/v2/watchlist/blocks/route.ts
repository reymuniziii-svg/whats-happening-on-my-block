import { z } from "zod";
import { addWatchlistBlock } from "@/lib/watchlist/service";
import { applyWatchlistCookie, watchlistSessionFromRequest } from "@/lib/watchlist/session";
import { checkRateLimit } from "@/lib/ratelimit/memory-rate-limit";
import { requestIdFromRequest, withRequestIdHeader } from "@/lib/observability/request-id";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const addBlockSchema = z.object({
  block_id: z.string().min(5).max(500),
  normalized_address: z.string().min(1).max(255).optional(),
});

export async function POST(request: NextRequest) {
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

  const parsed = addBlockSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400, headers: withRequestIdHeader(requestId) });
  }

  const blocks = await addWatchlistBlock(session.sessionId, parsed.data.block_id, parsed.data.normalized_address);

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
