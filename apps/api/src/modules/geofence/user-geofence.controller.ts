import type { Context } from "hono";
import { ErrorCodes, errorResponse, successResponse } from "../../core/http";
import {
  assignGeofenceToUser,
  assignMultipleGeofencesToUser,
  assignAllGeofencesToUser,
  removeGeofenceFromUser,
  removeAllGeofencesFromUser,
  getUserGeofences,
  getGeofenceUsers,
  userHasAccessToGeofence,
} from "./user-geofence.service";
import {
  buildPaginationMetadata,
  PaginationError,
  parsePaginationParams,
} from "../../utils/pagination";

/**
 * Assigns one or more geofences to a user
 * Body: { user_id: string, geofence_ids: string[], assign_all?: boolean }
 */
export const assignGeofencesToUser = async (
  c: Context
): Promise<Response> => {
  try {
    const body = await c.req.json();
    const { user_id, geofence_ids, assign_all } = body;

    if (!user_id) {
      return errorResponse(c, "user_id is required", ErrorCodes.BAD_REQUEST);
    }

    const organization = c.get("organization");
    if (!organization) {
      return errorResponse(c, "Unauthorized", ErrorCodes.UNAUTHORIZED);
    }

    const organizationId = organization.id;

    // Option 1: Assign all geofences
    if (assign_all === true) {
      const result = await assignAllGeofencesToUser(user_id, organizationId);

      return successResponse(c, {
        message: `User assigned to all geofences (${result.totalGeofences} total)`,
        data: {
          new_assignments: result.newAssignments.length,
          existing_assignments: result.existingCount,
          total_geofences: result.totalGeofences,
        },
      });
    }

    // Option 2: Assign specific geofences
    if (!geofence_ids || !Array.isArray(geofence_ids)) {
      return errorResponse(
        c,
        "geofence_ids array is required when assign_all is false",
        ErrorCodes.BAD_REQUEST
      );
    }

    if (geofence_ids.length === 0) {
      return errorResponse(
        c,
        "At least one geofence_id is required",
        ErrorCodes.BAD_REQUEST
      );
    }

    // Single geofence assignment
    if (geofence_ids.length === 1) {
      const result = await assignGeofenceToUser(
        user_id,
        geofence_ids[0],
        organizationId
      );

      return successResponse(c, {
        message: result.exists
          ? "User already assigned to this geofence"
          : "User assigned to geofence successfully",
        data: result.assignment,
      });
    }

    // Multiple geofences assignment
    const result = await assignMultipleGeofencesToUser(
      user_id,
      geofence_ids,
      organizationId
    );

    return successResponse(c, {
      message: "Geofences assigned to user successfully",
      data: {
        new_assignments: result.newAssignments.length,
        existing_assignments: result.existingCount,
        total_requested: geofence_ids.length,
      },
    });
  } catch (error) {
    console.error("Error in assignGeofencesToUser:", error);
    return errorResponse(
      c,
      "Failed to assign geofences to user",
      ErrorCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Removes a geofence assignment from a user
 * Body: { user_id: string, geofence_id: string }
 */
export const removeGeofenceFromUserController = async (
  c: Context
): Promise<Response> => {
  try {
    const body = await c.req.json();
    const { user_id, geofence_id } = body;

    if (!user_id || !geofence_id) {
      return errorResponse(
        c,
        "user_id and geofence_id are required",
        ErrorCodes.BAD_REQUEST
      );
    }

    const organization = c.get("organization");
    if (!organization) {
      return errorResponse(c, "Unauthorized", ErrorCodes.UNAUTHORIZED);
    }

    const deleted = await removeGeofenceFromUser(
      user_id,
      geofence_id,
      organization.id
    );

    if (deleted.length === 0) {
      return errorResponse(
        c,
        "Geofence assignment not found",
        ErrorCodes.NOT_FOUND
      );
    }

    return successResponse(c, {
      message: "Geofence removed from user successfully",
      data: deleted[0],
    });
  } catch (error) {
    console.error("Error in removeGeofenceFromUserController:", error);
    return errorResponse(
      c,
      "Failed to remove geofence from user",
      ErrorCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Removes all geofence assignments from a user
 * Body: { user_id: string }
 */
export const removeAllGeofencesFromUserController = async (
  c: Context
): Promise<Response> => {
  try {
    const body = await c.req.json();
    const { user_id } = body;

    if (!user_id) {
      return errorResponse(c, "user_id is required", ErrorCodes.BAD_REQUEST);
    }

    const organization = c.get("organization");
    if (!organization) {
      return errorResponse(c, "Unauthorized", ErrorCodes.UNAUTHORIZED);
    }

    const deleted = await removeAllGeofencesFromUser(
      user_id,
      organization.id
    );

    return successResponse(c, {
      message: `Removed ${deleted.length} geofence assignment(s) from user`,
      data: {
        removed_count: deleted.length,
      },
    });
  } catch (error) {
    console.error("Error in removeAllGeofencesFromUserController:", error);
    return errorResponse(
      c,
      "Failed to remove geofences from user",
      ErrorCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Gets all geofences assigned to a user
 * Query: ?user_id=xxx
 */
export const getUserGeofencesController = async (
  c: Context
): Promise<Response> => {
  try {
    const user_id = c.req.query("user_id");

    if (!user_id) {
      return errorResponse(c, "user_id is required", ErrorCodes.BAD_REQUEST);
    }

    const organization = c.get("organization");
    if (!organization) {
      return errorResponse(c, "Unauthorized", ErrorCodes.UNAUTHORIZED);
    }

    const pagination = parsePaginationParams(c.req.query("page"), c.req.query("pageSize"));

    const { assignments, total } = await getUserGeofences(
      user_id,
      organization.id,
      pagination
    );

    return successResponse(c, {
      message: "User geofences retrieved successfully",
      data: assignments,
      pagination: buildPaginationMetadata(pagination, total),
    });
  } catch (error) {
    console.error("Error in getUserGeofencesController:", error);
    if (error instanceof PaginationError) {
      return errorResponse(c, error.message, ErrorCodes.BAD_REQUEST);
    }
    return errorResponse(
      c,
      "Failed to get user geofences",
      ErrorCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Gets all users assigned to a geofence
 * Query: ?geofence_id=xxx
 */
export const getGeofenceUsersController = async (
  c: Context
): Promise<Response> => {
  try {
    const geofence_id = c.req.query("geofence_id");

    if (!geofence_id) {
      return errorResponse(
        c,
        "geofence_id is required",
        ErrorCodes.BAD_REQUEST
      );
    }

    const organization = c.get("organization");
    if (!organization) {
      return errorResponse(c, "Unauthorized", ErrorCodes.UNAUTHORIZED);
    }

    const pagination = parsePaginationParams(c.req.query("page"), c.req.query("pageSize"));

    const { assignments, total } = await getGeofenceUsers(
      geofence_id,
      organization.id,
      pagination
    );

    return successResponse(c, {
      message: "Geofence users retrieved successfully",
      data: assignments,
      pagination: buildPaginationMetadata(pagination, total),
    });
  } catch (error) {
    console.error("Error in getGeofenceUsersController:", error);
    if (error instanceof PaginationError) {
      return errorResponse(c, error.message, ErrorCodes.BAD_REQUEST);
    }
    return errorResponse(
      c,
      "Failed to get geofence users",
      ErrorCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Checks if a user has access to a specific geofence
 * Body: { user_id: string, geofence_id: string }
 */
export const checkUserGeofenceAccessController = async (
  c: Context
): Promise<Response> => {
  try {
    const body = await c.req.json();
    const { user_id, geofence_id } = body;

    if (!user_id || !geofence_id) {
      return errorResponse(
        c,
        "user_id and geofence_id are required",
        ErrorCodes.BAD_REQUEST
      );
    }

    const organization = c.get("organization");
    if (!organization) {
      return errorResponse(c, "Unauthorized", ErrorCodes.UNAUTHORIZED);
    }

    const hasAccess = await userHasAccessToGeofence(
      user_id,
      geofence_id,
      organization.id
    );

    return successResponse(c, {
      message: hasAccess ? "User has access" : "User does not have access",
      data: {
        has_access: hasAccess,
      },
    });
  } catch (error) {
    console.error("Error in checkUserGeofenceAccessController:", error);
    return errorResponse(
      c,
      "Failed to check user geofence access",
      ErrorCodes.INTERNAL_SERVER_ERROR
    );
  }
};
