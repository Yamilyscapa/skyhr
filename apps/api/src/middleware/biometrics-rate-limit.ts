import { createHash } from "node:crypto";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import type Redis from "ioredis";
import {
  getBiometricRateLimitPolicy,
  type BiometricRateLimitPolicyId,
  type RateLimitRule,
  type RateLimitScope,
  rateLimitConfig,
} from "../config/rate-limit";
import { ErrorCodes, errorResponse } from "../core/http";
import { getRateLimitRedisClient } from "../utils/redis";

const INCR_WITH_TTL_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("TTL", KEYS[1])
return {current, ttl}
`;

interface RateLimitVariables {
  user?: {
    id: string;
  };
  organization?: {
    id: string;
  };
}

interface RateLimitOutcome {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAtMs: number;
  retryAfterSec: number;
  scope: RateLimitScope;
  policyId: BiometricRateLimitPolicyId;
}

const localFallbackStore = new Map<
  string,
  { count: number; expiresAt: number }
>();

function hashIpAddress(ip: string): string {
  return createHash("sha256")
    .update(`${rateLimitConfig.ipSalt}:${ip}`)
    .digest("hex")
    .slice(0, 24);
}

function getClientIp(c: Context): string {
  const forwardedFor = c.req.header("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  const realIp = c.req.header("x-real-ip");
  if (realIp) {
    return realIp;
  }

  const cfConnectingIp = c.req.header("cf-connecting-ip");
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  return "unknown";
}

function getScopeKey(
  c: Context<{ Variables: RateLimitVariables }>,
  scope: RateLimitScope,
): string | null {
  const user = c.get("user") as { id: string } | undefined;
  const organization = c.get("organization") as { id: string } | undefined;
  const hashedIp = hashIpAddress(getClientIp(c));

  switch (scope) {
    case "ip":
      return `ip:${hashedIp}`;
    case "orgIp":
      if (!organization?.id) {
        return null;
      }
      return `org:${organization.id}:ip:${hashedIp}`;
    case "org":
      if (!organization?.id) {
        return null;
      }
      return `org:${organization.id}`;
    case "userOrg":
      if (!organization?.id || !user?.id) {
        return null;
      }
      return `org:${organization.id}:user:${user.id}`;
    case "user":
      if (!user?.id) {
        return null;
      }
      return `user:${user.id}`;
    default:
      return null;
  }
}

function buildRedisKey(
  policyId: BiometricRateLimitPolicyId,
  scope: RateLimitScope,
  scopeKey: string,
  rule: RateLimitRule,
  nowMs: number,
): string {
  const bucket = Math.floor(nowMs / (rule.windowSec * 1000));
  return `${rateLimitConfig.keyPrefix}:${policyId}:${scope}:${scopeKey}:${rule.windowSec}:${bucket}`;
}

function applyLimitHeaders(c: Context, outcome: RateLimitOutcome): void {
  c.header("X-RateLimit-Limit", String(outcome.limit));
  c.header("X-RateLimit-Remaining", String(Math.max(0, outcome.remaining)));
  c.header("X-RateLimit-Reset", String(Math.ceil(outcome.resetAtMs / 1000)));
  c.header("X-RateLimit-Policy", outcome.policyId);
}

async function checkRedisWindow(
  redisClient: Redis,
  key: string,
  rule: RateLimitRule,
  nowMs: number,
): Promise<
  Pick<
    RateLimitOutcome,
    "allowed" | "remaining" | "retryAfterSec" | "resetAtMs"
  >
> {
  const rawResult = await redisClient.eval(
    INCR_WITH_TTL_SCRIPT,
    1,
    key,
    String(rule.windowSec),
  );
  const [rawCount, rawTtl] = Array.isArray(rawResult)
    ? rawResult
    : [1, rule.windowSec];
  const count = Number(rawCount ?? 1);
  const ttl = Number(rawTtl ?? rule.windowSec);

  const safeTtl = ttl > 0 ? ttl : rule.windowSec;
  const resetAtMs = nowMs + safeTtl * 1000;
  const remaining = Math.max(0, rule.limit - count);

  if (count > rule.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: safeTtl,
      resetAtMs,
    };
  }

  return {
    allowed: true,
    remaining,
    retryAfterSec: 0,
    resetAtMs,
  };
}

function cleanLocalFallbackStore(nowMs: number): void {
  if (localFallbackStore.size <= rateLimitConfig.localFallbackMaxKeys) {
    return;
  }

  for (const [key, entry] of localFallbackStore.entries()) {
    if (entry.expiresAt <= nowMs) {
      localFallbackStore.delete(key);
    }
  }

  if (localFallbackStore.size <= rateLimitConfig.localFallbackMaxKeys) {
    return;
  }

  const overflow =
    localFallbackStore.size - rateLimitConfig.localFallbackMaxKeys;
  let removed = 0;
  for (const key of localFallbackStore.keys()) {
    localFallbackStore.delete(key);
    removed += 1;
    if (removed >= overflow) {
      break;
    }
  }
}

function checkLocalWindow(
  key: string,
  rule: RateLimitRule,
  nowMs: number,
): Pick<
  RateLimitOutcome,
  "allowed" | "remaining" | "retryAfterSec" | "resetAtMs"
> {
  cleanLocalFallbackStore(nowMs);

  const resetAtMs = nowMs + rule.windowSec * 1000;
  const existing = localFallbackStore.get(key);

  if (!existing || existing.expiresAt <= nowMs) {
    localFallbackStore.set(key, { count: 1, expiresAt: resetAtMs });
    return {
      allowed: true,
      remaining: Math.max(0, rule.limit - 1),
      retryAfterSec: 0,
      resetAtMs,
    };
  }

  existing.count += 1;

  if (existing.count > rule.limit) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((existing.expiresAt - nowMs) / 1000),
    );
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec,
      resetAtMs: existing.expiresAt,
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, rule.limit - existing.count),
    retryAfterSec: 0,
    resetAtMs: existing.expiresAt,
  };
}

async function evaluatePolicy(
  c: Context<{ Variables: RateLimitVariables }>,
  policyId: BiometricRateLimitPolicyId,
  useRedis: boolean,
  redisClient: Redis | null,
): Promise<RateLimitOutcome | null> {
  const policy = getBiometricRateLimitPolicy(policyId);
  const nowMs = Date.now();

  let tightestAllowed: RateLimitOutcome | null = null;

  const scopedRules = Object.entries(policy.scopes) as Array<
    [RateLimitScope, RateLimitRule[] | undefined]
  >;

  for (const [scope, rules] of scopedRules) {
    if (!rules || rules.length === 0) {
      continue;
    }

    const scopeKey = getScopeKey(c, scope);
    if (!scopeKey) {
      continue;
    }

    for (const rule of rules) {
      const key = buildRedisKey(policyId, scope, scopeKey, rule, nowMs);

      const windowOutcome =
        useRedis && redisClient
          ? await checkRedisWindow(redisClient, key, rule, nowMs)
          : checkLocalWindow(key, rule, nowMs);

      const outcome: RateLimitOutcome = {
        allowed: windowOutcome.allowed,
        limit: rule.limit,
        remaining: windowOutcome.remaining,
        resetAtMs: windowOutcome.resetAtMs,
        retryAfterSec: windowOutcome.retryAfterSec,
        scope,
        policyId,
      };

      if (!outcome.allowed) {
        return outcome;
      }

      if (!tightestAllowed || outcome.remaining < tightestAllowed.remaining) {
        tightestAllowed = outcome;
      }
    }
  }

  return tightestAllowed;
}

function buildRateLimitExceededMessage(retryAfterSec: number): string {
  return `Too many biometric requests. Please try again in ${retryAfterSec} seconds.`;
}

export function biometricRateLimit(policyId: BiometricRateLimitPolicyId) {
  return createMiddleware<{ Variables: RateLimitVariables }>(
    async (c, next) => {
      if (!rateLimitConfig.enabled) {
        await next();
        return;
      }

      const policy = getBiometricRateLimitPolicy(policyId);

      let redisClient: Redis | null = null;
      let useRedis = false;

      try {
        redisClient = await getRateLimitRedisClient();
        useRedis = Boolean(redisClient);
      } catch (error) {
        useRedis = false;
        console.error("[rate-limit] Redis resolution failed", {
          policyId,
          error,
        });
      }

      if (!useRedis && policy.redisFailureMode === "closed") {
        return errorResponse(
          c,
          "Rate limit service is temporarily unavailable",
          ErrorCodes.SERVICE_UNAVAILABLE,
        );
      }

      let outcome: RateLimitOutcome | null = null;

      try {
        outcome = await evaluatePolicy(c, policyId, useRedis, redisClient);
      } catch (error) {
        console.error("[rate-limit] Evaluation failed", {
          policyId,
          backend: useRedis ? "redis" : "local",
          error,
        });

        if (policy.redisFailureMode === "closed") {
          return errorResponse(
            c,
            "Rate limit service is temporarily unavailable",
            ErrorCodes.SERVICE_UNAVAILABLE,
          );
        }

        try {
          outcome = await evaluatePolicy(c, policyId, false, null);
        } catch (fallbackError) {
          console.error("[rate-limit] Local fallback failed", {
            policyId,
            error: fallbackError,
          });
        }
      }

      if (outcome && !outcome.allowed) {
        applyLimitHeaders(c, outcome);
        c.header("Retry-After", String(outcome.retryAfterSec));

        return errorResponse(
          c,
          buildRateLimitExceededMessage(outcome.retryAfterSec),
          ErrorCodes.TOO_MANY_REQUESTS,
          {
            retryAfterSec: outcome.retryAfterSec,
            policy: outcome.policyId,
            scope: outcome.scope,
          },
        );
      }

      if (outcome) {
        applyLimitHeaders(c, outcome);
      }

      await next();
    },
  );
}
