import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "whats-happening-on-my-block",
    timestamp_utc: new Date().toISOString(),
  });
}
