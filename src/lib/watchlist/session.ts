import type { NextRequest, NextResponse } from "next/server";
import { createWatchlistSessionId, createWatchlistToken, verifyWatchlistToken } from "@/lib/watchlist/session-token";

export const WATCHLIST_COOKIE = "whomb_sid";

export interface WatchlistSessionInfo {
  sessionId: string;
  isNew: boolean;
}

export function watchlistSessionFromRequest(request: NextRequest): WatchlistSessionInfo {
  const token = request.cookies.get(WATCHLIST_COOKIE)?.value;
  const existing = verifyWatchlistToken(token);
  if (existing) {
    return {
      sessionId: existing,
      isNew: false,
    };
  }

  return {
    sessionId: createWatchlistSessionId(),
    isNew: true,
  };
}

export function applyWatchlistCookie(response: NextResponse, session: WatchlistSessionInfo): void {
  if (!session.isNew) {
    return;
  }

  response.cookies.set({
    name: WATCHLIST_COOKIE,
    value: createWatchlistToken(session.sessionId),
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}
