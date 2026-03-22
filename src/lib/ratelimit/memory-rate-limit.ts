import { checkRedisRateLimit } from "@/lib/ratelimit/redis-rate-limit";

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 30;

interface Bucket {
  count: number;
  resetAt: number;
}

interface RateLimitOptions {
  namespace?: string;
  maxRequests?: number;
  windowMs?: number;
}

const buckets = new Map<string, Bucket>();

function normalizeOptions(options?: RateLimitOptions) {
  return {
    namespace: options?.namespace ?? "default",
    maxRequests: options?.maxRequests ?? DEFAULT_MAX_REQUESTS,
    windowMs: options?.windowMs ?? DEFAULT_WINDOW_MS,
  };
}

function memoryLimit(key: string, options?: RateLimitOptions): { allowed: boolean; retryAfterSeconds?: number } {
  const normalized = normalizeOptions(options);
  const now = Date.now();
  const bucketKey = `${normalized.namespace}:${key}`;
  const current = buckets.get(bucketKey);

  if (!current || now > current.resetAt) {
    buckets.set(bucketKey, { count: 1, resetAt: now + normalized.windowMs });
    return { allowed: true };
  }

  if (current.count >= normalized.maxRequests) {
    return { allowed: false, retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000) };
  }

  current.count += 1;
  buckets.set(bucketKey, current);
  return { allowed: true };
}

export async function checkRateLimit(
  key: string,
  options?: RateLimitOptions,
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const normalized = normalizeOptions(options);

  const redisResult = await checkRedisRateLimit(key, {
    namespace: normalized.namespace,
    maxRequests: normalized.maxRequests,
    windowMs: normalized.windowMs,
  });

  if (redisResult) {
    return redisResult;
  }

  return memoryLimit(key, normalized);
}
