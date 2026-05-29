// Base trusted origins from environment
const envOrigins: string[] = process.env.TRUSTED_ORIGINS?.split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0) || [];

// Mobile app scheme - must match scheme in apps/mobile/app.json
const MOBILE_SCHEME = "mobile://";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

// Default dev origins: dashboard (3001), api self (8080), expo metro (8081), expo web (19006)
const DEV_LOCAL_ORIGINS = !IS_PRODUCTION
  ? [
      "http://localhost:3001",
      "http://127.0.0.1:3001",
      "http://localhost:8080",
      "http://localhost:8081",
      "http://localhost:19006",
    ]
  : [];

// Development Expo origins for local testing
const DEV_EXPO_ORIGINS = !IS_PRODUCTION
  ? [
      "exp://*/*",
      "exp://localhost:*/*",
    ]
  : [];

export const TRUSTED_ORIGINS: string[] = [
  ...envOrigins,
  MOBILE_SCHEME,
  ...DEV_LOCAL_ORIGINS,
  ...DEV_EXPO_ORIGINS,
];

/**
 * Resolve a request origin against the trust list.
 * - exact match -> allow
 * - dev only: if no envOrigins configured, echo origin back
 * - prod: never echo unknown origins (incompatible with credentials: true)
 */
export function resolveCorsOrigin(origin: string | undefined): string | null {
  if (!origin) return null;
  if (TRUSTED_ORIGINS.includes(origin)) return origin;
  if (!IS_PRODUCTION && envOrigins.length === 0) {
    // Dev convenience: echo any origin only when no explicit list was configured.
    return origin;
  }
  return null;
}

export function assertProductionCorsConfigured(): void {
  if (IS_PRODUCTION && envOrigins.length === 0) {
    console.error(
      "[CORS] TRUSTED_ORIGINS env is empty in production. Refusing all cross-origin requests.",
    );
  }
}
