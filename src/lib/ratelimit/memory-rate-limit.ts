const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 30;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function checkRateLimit(key: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || now > current.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }

  if (current.count >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000) };
  }

  current.count += 1;
  buckets.set(key, current);
  return { allowed: true };
}
