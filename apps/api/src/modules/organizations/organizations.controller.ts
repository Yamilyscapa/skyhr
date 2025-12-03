import type { Context } from "hono";
import { successResponse, errorResponse } from "../../core/http";
import { 
  createOrganizationCollection,
  deleteOrganizationCollection,
  getOrganization,
  ensureOrganizationCollection
} from "./organizations.service";
import {
  getOrganizationSettings,
  ensureOrganizationSettings,
} from "../attendance/attendance.service";
import { db } from "../../db";
import { invitation, organization_settings } from "../../db/schema";
import { and, eq, ilike } from "drizzle-orm";

/**
 * Webhook handler for organization creation events
 * This will be called when Better Auth creates a new organization
 */
export const handleOrganizationCreated = async (c: Context) => {
  try {
    const body = await c.req.json();
    const { organizationId } = body;
    
    if (!organizationId) {
      return errorResponse(c, "Organization ID is required", 400);
    }
    
    // Create Rekognition collection for the new organization
    const collectionId = await createOrganizationCollection(organizationId);
    
    if (collectionId) {
      return successResponse(c, {
        message: "Organization collection created successfully",
        data: { 
          organizationId, 
          collectionId 
        }
      });
    } else {
      return errorResponse(c, "Failed to create organization collection", 500);
    }
  } catch (error) {
    console.error("Organization creation webhook error:", error);
    return errorResponse(c, "Internal server error", 500);
  }
};

/**
 * Webhook handler for organization deletion events
 * This will be called when Better Auth deletes an organization
 */
export const handleOrganizationDeleted = async (c: Context) => {
  try {
    const body = await c.req.json();
    const { organizationId } = body;
    
    if (!organizationId) {
      return errorResponse(c, "Organization ID is required", 400);
    }
    
    // Delete Rekognition collection for the organization
    const success = await deleteOrganizationCollection(organizationId);
    
    if (success) {
      return successResponse(c, {
        message: "Organization collection deleted successfully",
        data: { organizationId }
      });
    } else {
      return errorResponse(c, "Failed to delete organization collection", 500);
    }
  } catch (error) {
    console.error("Organization deletion webhook error:", error);
    return errorResponse(c, "Internal server error", 500);
  }
};

/**
 * Get organization details including collection info
 */
export const getOrganizationDetails = async (c: Context) => {
  try {
    const organizationId = c.req.param("organizationId");
    
    if (!organizationId) {
      return errorResponse(c, "Organization ID is required", 400);
    }
    
    const organization = await getOrganization(organizationId);
    
    if (!organization) {
      return errorResponse(c, "Organization not found", 404);
    }
    
    return successResponse(c, {
      message: "Organization retrieved successfully",
      data: organization
    });
  } catch (error) {
    console.error("Get organization error:", error);
    return errorResponse(c, "Internal server error", 500);
  }
};

/**
 * Manually create or ensure organization collection exists
 * Useful for existing organizations or recovery scenarios
 */
export const ensureCollection = async (c: Context) => {
  try {
    const organizationId = c.req.param("organizationId");
    
    if (!organizationId) {
      return errorResponse(c, "Organization ID is required", 400);
    }
    
    console.log(`[ensureCollection] Manual collection creation requested for organization: ${organizationId}`);
    
    const collectionId = await ensureOrganizationCollection(organizationId);
    
    if (collectionId) {
      console.log(`[ensureCollection] Successfully ensured collection ${collectionId} for organization: ${organizationId}`);
      return successResponse(c, {
        message: "Organization collection ensured successfully",
        data: { 
          organizationId, 
          collectionId 
        }
      });
    } else {
      console.error(`[ensureCollection] Failed to ensure collection for organization: ${organizationId}`);
      return errorResponse(c, "Failed to ensure organization collection", 500);
    }
  } catch (error) {
    console.error(`[ensureCollection] Error ensuring collection:`, {
      organizationId: c.req.param("organizationId"),
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    return errorResponse(c, "Internal server error", 500);
  }
};

/**
 * Get organization settings
 */
export const getSettings = async (c: Context) => {
  try {
    const organizationId = c.req.param("organizationId");
    const organization = c.get("organization");

    if (!organizationId) {
      return errorResponse(c, "Organization ID is required", 400);
    }

    // Verify user has access to this organization
    if (organization && organization.id !== organizationId) {
      return errorResponse(c, "Unauthorized to access this organization's settings", 403);
    }

    // Ensure settings exist (create with defaults if not)
    const settings = await ensureOrganizationSettings(organizationId);

    return successResponse(c, {
      message: "Organization settings retrieved successfully",
      data: settings,
    });
  } catch (error) {
    console.error("Get settings error:", error);
    return errorResponse(c, "Internal server error", 500);
  }
};

/**
 * Update organization settings
 */
export const updateSettings = async (c: Context) => {
  try {
    const organizationId = c.req.param("organizationId");
    const organization = c.get("organization");
    const body = await c.req.json();
    let gracePeriodMinutes: number | undefined;
    let extraHourCost: number | undefined;
    let timezone: string | undefined;

    if (!organizationId) {
      return errorResponse(c, "Organization ID is required", 400);
    }

    // Verify user has access to this organization
    if (organization && organization.id !== organizationId) {
      return errorResponse(c, "Unauthorized to update this organization's settings", 403);
    }

    // Validate grace_period_minutes if provided
    if (body.grace_period_minutes !== undefined) {
      const parsedGracePeriod = Number(body.grace_period_minutes);
      if (isNaN(parsedGracePeriod) || parsedGracePeriod < 0 || parsedGracePeriod > 60) {
        return errorResponse(c, "grace_period_minutes must be between 0 and 60", 400);
      }
      gracePeriodMinutes = Math.round(parsedGracePeriod);
    }

    if (body.extra_hour_cost !== undefined) {
      const parsedExtraHourCost = Number(body.extra_hour_cost);
      if (isNaN(parsedExtraHourCost) || parsedExtraHourCost < 0) {
        return errorResponse(c, "extra_hour_cost must be a number greater or equal to 0", 400);
      }
      extraHourCost = Number(parsedExtraHourCost.toFixed(2));
    }

    if (body.timezone !== undefined) {
      timezone = String(body.timezone).trim();
      if (!timezone) {
        return errorResponse(c, "timezone must be a non-empty string", 400);
      }
    }

    // Ensure settings exist first
    await ensureOrganizationSettings(organizationId);

    const updateData: Partial<typeof organization_settings.$inferInsert> = {
      updated_at: new Date(),
    };

    if (gracePeriodMinutes !== undefined) {
      updateData.grace_period_minutes = gracePeriodMinutes;
    }

    if (extraHourCost !== undefined) {
      updateData.extra_hour_cost = extraHourCost;
    }

    if (timezone !== undefined) {
      updateData.timezone = timezone;
    }

    // Update settings
    const updated = await db
      .update(organization_settings)
      .set(updateData)
      .where(eq(organization_settings.organization_id, organizationId))
      .returning();

    if (!updated || updated.length === 0) {
      return errorResponse(c, "Failed to update settings", 500);
    }

    return successResponse(c, {
      message: "Organization settings updated successfully",
      data: updated[0],
    });
  } catch (error) {
    console.error("Update settings error:", error);
    return errorResponse(c, "Internal server error", 500);
  }
};

/**
 * Get a single invitation for an organization by email
 */
export const getInvitationByEmail = async (c: Context) => {
  try {
    const organizationId = c.req.param("organizationId");
    const emailParam = c.req.query("email");
    const contextOrganization = c.get("organization");

    if (!organizationId) {
      return errorResponse(c, "Organization ID is required", 400);
    }

    if (!emailParam) {
      return errorResponse(c, "Email is required", 400);
    }

    // Quick format sanity check before querying
    const normalizedEmail = emailParam.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return errorResponse(c, "A valid email address is required", 400);
    }

    if (contextOrganization && contextOrganization.id !== organizationId) {
      return errorResponse(c, "Unauthorized to access this organization's invitations", 403);
    }

    const [invitationRecord] = await db
      .select({
        id: invitation.id,
        organizationId: invitation.organizationId,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        inviterId: invitation.inviterId,
        teamId: invitation.teamId,
      })
      .from(invitation)
      .where(
        and(
          eq(invitation.organizationId, organizationId),
          ilike(invitation.email, normalizedEmail)
        )
      )
      .limit(1);

    if (!invitationRecord) {
      return errorResponse(c, "Invitation not found", 404);
    }

    return successResponse(c, {
      message: "Invitation retrieved successfully",
      data: invitationRecord,
    });
  } catch (error) {
    console.error("Get invitation by email error:", error);
    return errorResponse(c, "Internal server error", 500);
  }
};

/**
 * Public endpoint to check if an invitation exists for an email
 * Returns only pending/not_found without exposing organization details
 */
export const getInvitationStatusPublic = async (c: Context) => {
  try {
    const emailParam = c.req.query("email");

    if (!emailParam) {
      return errorResponse(c, "Email is required", 400);
    }

    const normalizedEmail = emailParam.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return errorResponse(c, "A valid email address is required", 400);
    }

    const [invitationRecord] = await db
      .select({ id: invitation.id })
      .from(invitation)
      .where(
        and(
          ilike(invitation.email, normalizedEmail),
          eq(invitation.status, "pending")
        )
      )
      .limit(1);

    return successResponse(c, {
      message: invitationRecord ? "Invitation pending" : "Invitation not found",
      data: {
        status: invitationRecord ? "pending" : "not_found",
        pending: Boolean(invitationRecord),
      },
    });
  } catch (error) {
    console.error("Public invitation status lookup error:", error);
    return errorResponse(c, "Internal server error", 500);
  }
};
