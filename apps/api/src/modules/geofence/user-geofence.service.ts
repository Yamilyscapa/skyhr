import { db } from "../../db";
import { geofence, user_geofence, users } from "../../db/schema";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import type { PaginationParams } from "../../utils/pagination";

/**
 * Assigns a single geofence to a user
 */
export const assignGeofenceToUser = async (
  userId: string,
  geofenceId: string,
  organizationId: string
) => {
  // Check if assignment already exists
  const existing = await db
    .select()
    .from(user_geofence)
    .where(
      and(
        eq(user_geofence.user_id, userId),
        eq(user_geofence.geofence_id, geofenceId),
        eq(user_geofence.organization_id, organizationId)
      )
    );

  if (existing.length > 0) {
    return { exists: true, assignment: existing[0] };
  }

  const assignment = await db
    .insert(user_geofence)
    .values({
      user_id: userId,
      geofence_id: geofenceId,
      organization_id: organizationId,
    })
    .returning();

  return { exists: false, assignment: assignment[0] };
};

/**
 * Assigns multiple geofences to a user
 */
export const assignMultipleGeofencesToUser = async (
  userId: string,
  geofenceIds: string[],
  organizationId: string
) => {
  // Get existing assignments
  const existingAssignments = await db
    .select()
    .from(user_geofence)
    .where(
      and(
        eq(user_geofence.user_id, userId),
        inArray(user_geofence.geofence_id, geofenceIds),
        eq(user_geofence.organization_id, organizationId)
      )
    );

  const existingGeofenceIds = existingAssignments.map((a) => a.geofence_id);
  const newGeofenceIds = geofenceIds.filter(
    (id) => !existingGeofenceIds.includes(id)
  );

  if (newGeofenceIds.length === 0) {
    return { newAssignments: [], existingCount: existingAssignments.length };
  }

  const newAssignments = await db
    .insert(user_geofence)
    .values(
      newGeofenceIds.map((geofenceId) => ({
        user_id: userId,
        geofence_id: geofenceId,
        organization_id: organizationId,
      }))
    )
    .returning();

  return { newAssignments, existingCount: existingAssignments.length };
};

/**
 * Assigns all geofences in an organization to a user
 */
export const assignAllGeofencesToUser = async (
  userId: string,
  organizationId: string
) => {
  // Get all active geofences for the organization
  const allGeofences = await db
    .select({ id: geofence.id })
    .from(geofence)
    .where(
      and(
        eq(geofence.organization_id, organizationId),
        eq(geofence.active, true)
      )
    );

  if (allGeofences.length === 0) {
    return { newAssignments: [], existingCount: 0, totalGeofences: 0 };
  }

  const geofenceIds = allGeofences.map((g) => g.id);

  const result = await assignMultipleGeofencesToUser(
    userId,
    geofenceIds,
    organizationId
  );

  return { ...result, totalGeofences: allGeofences.length };
};

/**
 * Removes a geofence assignment from a user
 */
export const removeGeofenceFromUser = async (
  userId: string,
  geofenceId: string,
  organizationId: string
) => {
  const deleted = await db
    .delete(user_geofence)
    .where(
      and(
        eq(user_geofence.user_id, userId),
        eq(user_geofence.geofence_id, geofenceId),
        eq(user_geofence.organization_id, organizationId)
      )
    )
    .returning();

  return deleted;
};

/**
 * Removes all geofence assignments from a user
 */
export const removeAllGeofencesFromUser = async (
  userId: string,
  organizationId: string
) => {
  const deleted = await db
    .delete(user_geofence)
    .where(
      and(
        eq(user_geofence.user_id, userId),
        eq(user_geofence.organization_id, organizationId)
      )
    )
    .returning();

  return deleted;
};

/**
 * Gets all geofences assigned to a user
 */
export const getUserGeofences = async (
  userId: string,
  organizationId: string,
  pagination?: PaginationParams
) => {
  const whereClause = and(
    eq(user_geofence.user_id, userId),
    eq(user_geofence.organization_id, organizationId)
  );

  const totalResult = await db
    .select({ value: count() })
    .from(user_geofence)
    .where(whereClause);

  const baseQuery = db
    .select({
      id: user_geofence.id,
      geofence_id: user_geofence.geofence_id,
      created_at: user_geofence.created_at,
      geofence: {
        id: geofence.id,
        name: geofence.name,
        type: geofence.type,
        center_latitude: geofence.center_latitude,
        center_longitude: geofence.center_longitude,
        radius: geofence.radius,
        qr_code_url: geofence.qr_code_url,
        active: geofence.active,
      },
    })
    .from(user_geofence)
    .leftJoin(geofence, eq(user_geofence.geofence_id, geofence.id))
    .where(whereClause)
    .orderBy(desc(user_geofence.created_at));

  const assignments = await (pagination
    ? baseQuery.limit(pagination.limit).offset(pagination.offset)
    : baseQuery);

  return {
    assignments,
    total: Number(totalResult[0]?.value ?? 0),
  };
};

/**
 * Gets all users assigned to a geofence
 */
export const getGeofenceUsers = async (
  geofenceId: string,
  organizationId: string,
  pagination?: PaginationParams
) => {
  const whereClause = and(
    eq(user_geofence.geofence_id, geofenceId),
    eq(user_geofence.organization_id, organizationId)
  );

  const totalResult = await db
    .select({ value: count() })
    .from(user_geofence)
    .where(whereClause);

  const baseQuery = db
    .select({
      id: user_geofence.id,
      user_id: user_geofence.user_id,
      created_at: user_geofence.created_at,
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
      },
    })
    .from(user_geofence)
    .leftJoin(users, eq(user_geofence.user_id, users.id))
    .where(whereClause)
    .orderBy(desc(user_geofence.created_at));

  const assignments = await (pagination
    ? baseQuery.limit(pagination.limit).offset(pagination.offset)
    : baseQuery);

  return {
    assignments,
    total: Number(totalResult[0]?.value ?? 0),
  };
};

/**
 * Checks if a user has access to a specific geofence
 */
export const userHasAccessToGeofence = async (
  userId: string,
  geofenceId: string,
  organizationId: string
): Promise<boolean> => {
  const assignment = await db
    .select()
    .from(user_geofence)
    .where(
      and(
        eq(user_geofence.user_id, userId),
        eq(user_geofence.geofence_id, geofenceId),
        eq(user_geofence.organization_id, organizationId)
      )
    );

  return assignment.length > 0;
};
