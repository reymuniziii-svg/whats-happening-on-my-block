import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

export function requestIdFromRequest(request: NextRequest): string {
  const incoming = request.headers.get("x-request-id")?.trim();
  if (incoming) {
    return incoming;
  }
  return randomUUID();
}

export function withRequestIdHeader(requestId: string, headers: HeadersInit = {}): HeadersInit {
  return {
    ...headers,
    "x-request-id": requestId,
  };
}
