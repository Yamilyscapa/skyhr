import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { timingSafeEqual } from "node:crypto";

/**
 * Shared-secret middleware for internal webhooks (e.g. Better Auth org lifecycle).
 * Caller must send `x-webhook-secret` header matching ORG_WEBHOOK_SECRET env.
 * Uses constant-time comparison to prevent timing attacks.
 */
export const requireWebhookSecret = createMiddleware(async (c, next) => {
  const expected = process.env.ORG_WEBHOOK_SECRET;

  if (!expected) {
    console.error("[webhook-auth] ORG_WEBHOOK_SECRET not configured; rejecting webhook call");
    throw new HTTPException(503, { message: "Webhook authentication not configured" });
  }

  const provided = c.req.header("x-webhook-secret");

  if (!provided) {
    throw new HTTPException(401, { message: "Missing webhook secret" });
  }

  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);

  if (expectedBuf.length !== providedBuf.length || !timingSafeEqual(expectedBuf, providedBuf)) {
    throw new HTTPException(401, { message: "Invalid webhook secret" });
  }

  await next();
});
