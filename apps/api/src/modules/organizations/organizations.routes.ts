import { Hono } from "hono";
import { requireAuth, requireOrganization } from "../../middleware/auth-middleware";
import { requireWebhookSecret } from "../../middleware/webhook-auth";
import {
  handleOrganizationCreated,
  handleOrganizationDeleted,
  getOrganizationDetails,
  getCurrentOrganization,
  ensureCollection,
  getSettings,
  updateSettings,
  getInvitationByEmail,
  getInvitationStatusPublic,
} from "./organizations.controller";

const organizationsRouter = new Hono();

// Webhook endpoints for Better Auth organization events (shared-secret auth)
organizationsRouter.post("/webhook/created", requireWebhookSecret, handleOrganizationCreated);
organizationsRouter.post("/webhook/deleted", requireWebhookSecret, handleOrganizationDeleted);

// Public invitation status lookup (no auth, email only)
organizationsRouter.get("/invitations/status", getInvitationStatusPublic);

// Current org overview (must precede /:organizationId)
organizationsRouter.get("/me", requireAuth, requireOrganization, getCurrentOrganization);

// Management endpoints
organizationsRouter.get("/:organizationId", getOrganizationDetails);
organizationsRouter.post("/:organizationId/ensure-collection", ensureCollection);
organizationsRouter.get("/:organizationId/invitations/by-email", requireAuth, requireOrganization, getInvitationByEmail);

// Settings endpoints (requires auth)
organizationsRouter.get("/:organizationId/settings", requireAuth, requireOrganization, getSettings);
organizationsRouter.put("/:organizationId/settings", requireAuth, requireOrganization, updateSettings);

export default organizationsRouter; 
