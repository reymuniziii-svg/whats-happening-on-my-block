import { runWeeklyDigest } from "@/lib/digest/service";
import { requestIdFromRequest, withRequestIdHeader } from "@/lib/observability/request-id";
import { logger } from "@/lib/observability/logger";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) {
    return false;
  }

  const auth = request.headers.get("authorization")?.trim();
  return auth === `Bearer ${expected}`;
}

export async function POST(request: NextRequest) {
  const requestId = requestIdFromRequest(request);

  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: withRequestIdHeader(requestId) });
  }

  try {
    const digestResult = await runWeeklyDigest();
    return NextResponse.json(digestResult, { headers: withRequestIdHeader(requestId) });
  } catch (error) {
    logger.error({ request_id: requestId, error }, "digest cron failed");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Digest cron failed" },
      { status: 500, headers: withRequestIdHeader(requestId) },
    );
  }
}
