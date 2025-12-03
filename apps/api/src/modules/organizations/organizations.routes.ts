import { Hono } from "hono";
import { requireAuth, requireOrganization } from "../../middleware/auth-middleware";
import { 
  handleOrganizationCreated,
  handleOrganizationDeleted,
  getOrganizationDetails,
  ensureCollection,
  getSettings,
  updateSettings,
  getInvitationByEmail,
  getInvitationStatusPublic,
} from "./organizations.controller";

const organizationsRouter = new Hono();

// Webhook endpoints for Better Auth organization events
organizationsRouter.post("/webhook/created", handleOrganizationCreated);
organizationsRouter.post("/webhook/deleted", handleOrganizationDeleted);

// Public invitation status lookup (no auth, email only)
organizationsRouter.get("/invitations/status", getInvitationStatusPublic);

// Management endpoints
organizationsRouter.get("/:organizationId", getOrganizationDetails);
organizationsRouter.post("/:organizationId/ensure-collection", ensureCollection);
organizationsRouter.get("/:organizationId/invitations/by-email", requireAuth, requireOrganization, getInvitationByEmail);

// Settings endpoints (requires auth)
organizationsRouter.get("/:organizationId/settings", requireAuth, requireOrganization, getSettings);
organizationsRouter.put("/:organizationId/settings", requireAuth, requireOrganization, updateSettings);

export default organizationsRouter; 
