import { Hono } from "hono";
import { logger } from "hono/logger";
import router from "./router";
import { serveStatic } from "hono/serve-static";
import { cors } from "hono/cors";
import { TRUSTED_ORIGINS } from "./utils/cors";

// ENV
const PORT = process.env.PORT ?? 8080;

// APP
const app = new Hono();

// Middleware
app.use(logger());

// CORS configuration for auth routes (must be registered before routes)
// Following Better Auth Hono integration best practices
// Reference: https://www.better-auth.com/docs/integrations/hono
// Note: When credentials: true, origin cannot be "*" - must be specific origins
// If TRUSTED_ORIGINS is empty, echo back the requesting origin (permissive for development)
app.use(
  "/auth/*",
  cors({
    origin: TRUSTED_ORIGINS.length > 0 
      ? TRUSTED_ORIGINS 
      : (origin) => origin, // Echo back origin when TRUSTED_ORIGINS is empty (allows any origin)
    allowHeaders: ["Content-Type", "Authorization", "Cookie", "X-Requested-With"],
    allowMethods: ["POST", "GET", "OPTIONS", "PUT", "DELETE"],
    exposeHeaders: ["Content-Length", "Set-Cookie"],
    maxAge: 600,
    credentials: true,
  })
);

// Global CORS for other routes
// Reference: https://hono.dev/docs/middleware/builtin/cors
app.use(
  cors({
    origin: TRUSTED_ORIGINS.length > 0 
      ? TRUSTED_ORIGINS 
      : (origin) => origin, // Echo back origin when TRUSTED_ORIGINS is empty (allows any origin)
    allowHeaders: ["Authorization", "Content-Type", "Cookie"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);
  
// Router
app.route("/", router);

// Serve static files in development
if (process.env.NODE_ENV === "development" || !process.env.NODE_ENV) {
  app.get("/upload/*", serveStatic({ 
    root: "./upload",
    rewriteRequestPath: (path) => path.replace(/^\/upload/, ""),
    getContent: async (path, c) => {
      return Bun.file(path).stream();
    }
  }));
}

export default {
  port: PORT,
  fetch: app.fetch,
};
