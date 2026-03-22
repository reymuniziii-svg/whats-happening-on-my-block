import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { logger } from "@/lib/observability/logger";

interface RedisRateLimitOptions {
  namespace: string;
  maxRequests: number;
  windowMs: number;
}

const ratelimiters = new Map<string, Ratelimit>();
let redisClient: Redis | null = null;

function initRedis(): Redis | null {
  if (redisClient) {
    return redisClient;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return null;
  }

  redisClient = new Redis({
    url,
    token,
  });

  return redisClient;
}

function strategyKey(options: RedisRateLimitOptions): string {
  return `${options.namespace}:${options.maxRequests}:${options.windowMs}`;
}

function ratelimiterFor(options: RedisRateLimitOptions): Ratelimit | null {
  const redis = initRedis();
  if (!redis) {
    return null;
  }

  const key = strategyKey(options);
  const existing = ratelimiters.get(key);
  if (existing) {
    return existing;
  }

  const seconds = Math.max(1, Math.ceil(options.windowMs / 1000));
  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(options.maxRequests, `${seconds} s`),
    analytics: true,
    prefix: `whomb:${options.namespace}`,
  });

  ratelimiters.set(key, ratelimit);
  return ratelimit;
}

export async function checkRedisRateLimit(
  identifier: string,
  options: RedisRateLimitOptions,
): Promise<{ allowed: boolean; retryAfterSeconds?: number } | null> {
  const ratelimit = ratelimiterFor(options);
  if (!ratelimit) {
    return null;
  }

  try {
    const result = await ratelimit.limit(identifier);
    if (result.success) {
      return { allowed: true };
    }

    const retryAfterSeconds = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
    return {
      allowed: false,
      retryAfterSeconds,
    };
  } catch (error) {
    logger.warn({ identifier, options, error }, "redis rate limit failed; falling back to memory limiter");
    return null;
  }
}
