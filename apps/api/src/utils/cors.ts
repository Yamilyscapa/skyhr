// Base trusted origins from environment
const envOrigins: string[] = process.env.TRUSTED_ORIGINS?.split(",").map(origin => origin.trim()).filter(origin => origin.length > 0) || [];

// Mobile app scheme - must match scheme in apps/mobile/app.json
const MOBILE_SCHEME = "mobile://";

// Development Expo origins for local testing
const DEV_EXPO_ORIGINS = process.env.NODE_ENV !== "production" ? [
  "exp://*/*",              // Trust all Expo development URLs
  "exp://localhost:*/*",    // Trust localhost
] : [];

export const TRUSTED_ORIGINS: string[] = [
  ...envOrigins,
  MOBILE_SCHEME,
  ...DEV_EXPO_ORIGINS,
];
