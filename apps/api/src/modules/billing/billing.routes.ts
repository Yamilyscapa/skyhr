import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth-middleware";
import {
  createCheckoutSession,
  createPortalSession,
  getPlans,
  getSummary,
  stripeWebhook,
} from "./billing.controller";

const billingRouter = new Hono();

billingRouter.post("/webhook/stripe", stripeWebhook);
billingRouter.get("/plans", requireAuth, getPlans);
billingRouter.get("/:organizationId/summary", requireAuth, getSummary);
billingRouter.post(
  "/:organizationId/checkout-session",
  requireAuth,
  createCheckoutSession,
);
billingRouter.post(
  "/:organizationId/portal-session",
  requireAuth,
  createPortalSession,
);

export default billingRouter;
