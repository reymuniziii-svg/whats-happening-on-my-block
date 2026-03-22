import { Redis } from "@upstash/redis";
import { logger } from "@/lib/observability/logger";

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

export function redisEnabled(): boolean {
  return Boolean(initRedis());
}

export async function redisGet<T>(key: string): Promise<T | undefined> {
  const redis = initRedis();
  if (!redis) {
    return undefined;
  }

  try {
    const value = await redis.get<T>(key);
    return value ?? undefined;
  } catch (error) {
    logger.warn({ key, error }, "redis get failed");
    return undefined;
  }
}

export async function redisSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const redis = initRedis();
  if (!redis) {
    return;
  }

  try {
    await redis.set(key, value, {
      ex: ttlSeconds,
    });
  } catch (error) {
    logger.warn({ key, ttlSeconds, error }, "redis set failed");
  }
}

export async function redisDelete(key: string): Promise<void> {
  const redis = initRedis();
  if (!redis) {
    return;
  }

  try {
    await redis.del(key);
  } catch (error) {
    logger.warn({ key, error }, "redis del failed");
  }
}
