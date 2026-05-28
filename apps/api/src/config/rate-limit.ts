export type RateLimitScope = "ip" | "orgIp" | "org" | "userOrg" | "user";

export interface RateLimitRule {
  limit: number;
  windowSec: number;
}

export type RedisFailureMode = "open_with_local_fallback" | "closed";

export type BiometricRateLimitPolicyId =
  | "attendance.checkIn"
  | "attendance.watchModeCheckIn"
  | "biometrics.register"
  | "biometrics.search"
  | "biometrics.compareFacesPublic"
  | "biometrics.detectFacesPublic"
  | "biometrics.indexFaceAdmin"
  | "biometrics.searchFacesAdmin"
  | "biometrics.organizationIndexFaceAdmin"
  | "biometrics.organizationSearchFacesAdmin"
  | "biometrics.livenessSessionCreate"
  | "biometrics.livenessSessionResults";

export interface RateLimitPolicy {
  id: BiometricRateLimitPolicyId;
  redisFailureMode: RedisFailureMode;
  scopes: Partial<Record<RateLimitScope, RateLimitRule[]>>;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  return value.toLowerCase() !== "false";
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return parsed;
}

function buildRailwayRedisUrlFromParts(): string | undefined {
  const host = process.env.REDISHOST;
  const port = process.env.REDISPORT;

  if (!host || !port) {
    return undefined;
  }

  const user = process.env.REDISUSER;
  const password = process.env.REDISPASSWORD;

  if (user && password) {
    return `redis://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}`;
  }

  if (password) {
    return `redis://:${encodeURIComponent(password)}@${host}:${port}`;
  }

  return `redis://${host}:${port}`;
}

const redisUrl =
  process.env.REDIS_PRIVATE_URL ??
  process.env.REDIS_URL ??
  process.env.RATE_LIMIT_REDIS_URL ??
  buildRailwayRedisUrlFromParts();

export const rateLimitConfig = {
  enabled: parseBoolean(process.env.RATE_LIMIT_ENABLED, true),
  redisUrl,
  keyPrefix: process.env.RATE_LIMIT_KEY_PREFIX ?? "rl:skyhr",
  ipSalt: process.env.RATE_LIMIT_IP_SALT ?? "skyhr-rate-limit",
  redisConnectTimeoutMs: parseNumber(
    process.env.RATE_LIMIT_REDIS_CONNECT_TIMEOUT_MS,
    1000,
  ),
  redisCommandTimeoutMs: parseNumber(
    process.env.RATE_LIMIT_REDIS_COMMAND_TIMEOUT_MS,
    50,
  ),
  redisReconnectCooldownMs: parseNumber(
    process.env.RATE_LIMIT_REDIS_RECONNECT_COOLDOWN_MS,
    5000,
  ),
  localFallbackMaxKeys: parseNumber(
    process.env.RATE_LIMIT_LOCAL_MAX_KEYS,
    10000,
  ),
} as const;

if (rateLimitConfig.enabled && !rateLimitConfig.redisUrl) {
  console.warn(
    "[rate-limit] Redis URL not configured. Attendance routes will use local fallback and public biometric routes may return service unavailable.",
  );
}

export const biometricRateLimitPolicies: Record<
  BiometricRateLimitPolicyId,
  RateLimitPolicy
> = {
  "attendance.checkIn": {
    id: "attendance.checkIn",
    redisFailureMode: "open_with_local_fallback",
    scopes: {
      userOrg: [
        { limit: 6, windowSec: 10 * 60 },
        { limit: 20, windowSec: 60 * 60 },
      ],
      org: [
        { limit: 60, windowSec: 60 },
        { limit: 250, windowSec: 5 * 60 },
        { limit: 1200, windowSec: 60 * 60 },
      ],
      orgIp: [{ limit: 300, windowSec: 5 * 60 }],
    },
  },
  "attendance.watchModeCheckIn": {
    id: "attendance.watchModeCheckIn",
    redisFailureMode: "open_with_local_fallback",
    scopes: {
      orgIp: [
        { limit: 90, windowSec: 60 },
        { limit: 2500, windowSec: 60 * 60 },
      ],
      org: [{ limit: 400, windowSec: 5 * 60 }],
    },
  },
  "biometrics.register": {
    id: "biometrics.register",
    redisFailureMode: "open_with_local_fallback",
    scopes: {
      userOrg: [{ limit: 5, windowSec: 24 * 60 * 60 }],
      org: [{ limit: 300, windowSec: 24 * 60 * 60 }],
    },
  },
  "biometrics.search": {
    id: "biometrics.search",
    redisFailureMode: "open_with_local_fallback",
    scopes: {
      userOrg: [
        { limit: 12, windowSec: 60 },
        { limit: 300, windowSec: 60 * 60 },
      ],
      org: [{ limit: 800, windowSec: 60 * 60 }],
    },
  },
  "biometrics.compareFacesPublic": {
    id: "biometrics.compareFacesPublic",
    redisFailureMode: "closed",
    scopes: {
      ip: [
        { limit: 20, windowSec: 60 },
        { limit: 300, windowSec: 60 * 60 },
      ],
    },
  },
  "biometrics.detectFacesPublic": {
    id: "biometrics.detectFacesPublic",
    redisFailureMode: "closed",
    scopes: {
      ip: [
        { limit: 20, windowSec: 60 },
        { limit: 300, windowSec: 60 * 60 },
      ],
    },
  },
  "biometrics.indexFaceAdmin": {
    id: "biometrics.indexFaceAdmin",
    redisFailureMode: "open_with_local_fallback",
    scopes: {
      user: [{ limit: 120, windowSec: 60 * 60 }],
      ip: [{ limit: 240, windowSec: 60 * 60 }],
    },
  },
  "biometrics.searchFacesAdmin": {
    id: "biometrics.searchFacesAdmin",
    redisFailureMode: "open_with_local_fallback",
    scopes: {
      user: [{ limit: 500, windowSec: 60 * 60 }],
      ip: [{ limit: 1000, windowSec: 60 * 60 }],
    },
  },
  "biometrics.organizationIndexFaceAdmin": {
    id: "biometrics.organizationIndexFaceAdmin",
    redisFailureMode: "open_with_local_fallback",
    scopes: {
      user: [{ limit: 200, windowSec: 60 * 60 }],
      ip: [{ limit: 300, windowSec: 60 * 60 }],
    },
  },
  "biometrics.organizationSearchFacesAdmin": {
    id: "biometrics.organizationSearchFacesAdmin",
    redisFailureMode: "open_with_local_fallback",
    scopes: {
      user: [{ limit: 600, windowSec: 60 * 60 }],
      ip: [{ limit: 1200, windowSec: 60 * 60 }],
    },
  },
  "biometrics.livenessSessionCreate": {
    id: "biometrics.livenessSessionCreate",
    redisFailureMode: "open_with_local_fallback",
    scopes: {
      userOrg: [
        { limit: 20, windowSec: 10 * 60 },
        { limit: 80, windowSec: 60 * 60 },
      ],
      org: [{ limit: 1500, windowSec: 60 * 60 }],
    },
  },
  "biometrics.livenessSessionResults": {
    id: "biometrics.livenessSessionResults",
    redisFailureMode: "open_with_local_fallback",
    scopes: {
      userOrg: [
        { limit: 40, windowSec: 10 * 60 },
        { limit: 200, windowSec: 60 * 60 },
      ],
      org: [{ limit: 3000, windowSec: 60 * 60 }],
    },
  },
};

export function getBiometricRateLimitPolicy(
  policyId: BiometricRateLimitPolicyId,
): RateLimitPolicy {
  return biometricRateLimitPolicies[policyId];
}
