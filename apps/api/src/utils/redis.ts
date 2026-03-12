import Redis from "ioredis";
import { rateLimitConfig } from "../config/rate-limit";

let rateLimitRedisClient: Redis | null = null;
let lastConnectionFailureAt = 0;

function createRateLimitRedisClient(): Redis {
  const client = new Redis(rateLimitConfig.redisUrl!, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: rateLimitConfig.redisConnectTimeoutMs,
    commandTimeout: rateLimitConfig.redisCommandTimeoutMs,
    retryStrategy: (attempt) => Math.min(attempt * 50, 500),
  });

  client.on("error", (error) => {
    console.error("[rate-limit] Redis error", {
      message: error.message,
      code: (error as { code?: string }).code,
    });
  });

  return client;
}

export async function getRateLimitRedisClient(): Promise<Redis | null> {
  if (!rateLimitConfig.enabled || !rateLimitConfig.redisUrl) {
    return null;
  }

  const now = Date.now();
  if (
    now - lastConnectionFailureAt <
    rateLimitConfig.redisReconnectCooldownMs
  ) {
    return null;
  }

  if (!rateLimitRedisClient || rateLimitRedisClient.status === "end") {
    rateLimitRedisClient = createRateLimitRedisClient();
  }

  if (rateLimitRedisClient.status === "wait") {
    try {
      await rateLimitRedisClient.connect();
    } catch (error) {
      lastConnectionFailureAt = Date.now();
      console.error("[rate-limit] Redis connect failed", error);
      return null;
    }
  }

  return rateLimitRedisClient;
}
