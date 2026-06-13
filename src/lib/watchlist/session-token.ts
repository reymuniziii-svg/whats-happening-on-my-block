import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

function secret(): string {
  const configured = process.env.WATCHLIST_SIGNING_SECRET;
  if (configured) {
    return configured;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("WATCHLIST_SIGNING_SECRET must be set in production");
  }
  return "dev-watchlist-secret-change-me";
}

function signValue(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function createWatchlistSessionId(): string {
  return randomUUID();
}

export function createWatchlistToken(sessionId: string): string {
  const signature = signValue(sessionId);
  return `${sessionId}.${signature}`;
}

export function verifyWatchlistToken(token: string | undefined): string | null {
  if (!token) {
    return null;
  }

  const [sessionId, signature] = token.split(".");
  if (!sessionId || !signature) {
    return null;
  }

  const expected = signValue(sessionId);
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== providedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(expectedBuffer, providedBuffer)) {
    return null;
  }

  return sessionId;
}
