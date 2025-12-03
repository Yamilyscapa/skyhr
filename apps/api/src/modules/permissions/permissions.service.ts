import { and, count, desc, eq, isNull, or } from "drizzle-orm";
import { db } from "../../db";
import { permissions } from "../../db/schema";
import type { PaginationParams } from "../../utils/pagination";

export const PERMISSION_STATUSES = ["pending", "approved", "rejected"] as const;

export type PermissionStatus = (typeof PERMISSION_STATUSES)[number];
export type PermissionRecord = typeof permissions.$inferSelect;
export type PermissionInsert = typeof permissions.$inferInsert;

export interface PermissionFilters {
  status?: PermissionStatus;
  userId?: string;
}

export interface CreatePermissionData {
  userId: string;
  organizationId: string;
  message: string;
  startingDate: Date;
  endDate: Date;
  documentsUrl?: string[];
}

export interface UpdatePermissionData {
  message?: string;
  startingDate?: Date;
  endDate?: Date;
}

export interface ApprovePermissionData {
  approvedBy: string;
  comment?: string;
}

export interface RejectPermissionData {
  approvedBy: string;
  comment: string;
}

export function mapPermission(row: PermissionRecord) {
  return {
    id: row.id,
    userId: row.user_id ?? null,
    organizationId: row.organization_id ?? null,
    message: row.message,
    documentsUrl: row.documents_url ?? [],
    startingDate: row.starting_date,
    endDate: row.end_date,
    status: row.status,
    approvedBy: row.approved_by ?? null,
    supervisorComment: row.supervisor_comment ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function isAdminOrOwner(role?: string | null): boolean {
  return role === "admin" || role === "owner";
}

export function canModifyPermission(permission: PermissionRecord, userId: string, role?: string | null): boolean {
  if (permission.deleted_at) return false;
  if (permission.status !== "pending") return false;
  if (isAdminOrOwner(role)) return true;
  return permission.user_id === userId;
}

export async function createPermission(data: CreatePermissionData) {
  if (data.endDate <= data.startingDate) {
    throw new Error("end_date must be greater than starting_date");
  }

  const inserted = await db
    .insert(permissions)
    .values({
      user_id: data.userId,
      organization_id: data.organizationId,
      message: data.message,
      starting_date: data.startingDate,
      end_date: data.endDate,
      documents_url: data.documentsUrl ?? [],
      status: "pending",
      updated_at: new Date(),
    } satisfies PermissionInsert)
    .returning();

  return inserted.length ? mapPermission(inserted[0]!) : null;
}

export async function listPermissions(
  organizationId: string,
  filters: PermissionFilters = {},
  pagination?: PaginationParams,
  userId?: string,
  role?: string | null
) {
  const conditions = [
    eq(permissions.organization_id, organizationId),
    isNull(permissions.deleted_at),
  ];

  // If not admin/owner, only show own permissions
  if (!isAdminOrOwner(role)) {
    if (userId) {
      conditions.push(eq(permissions.user_id, userId));
    } else {
      // No userId and not admin - return empty
      return {
        data: [],
        total: 0,
      };
    }
  } else if (filters.userId) {
    // Admin can filter by userId
    conditions.push(eq(permissions.user_id, filters.userId));
  }

  if (filters.status) {
    conditions.push(eq(permissions.status, filters.status));
  }

  const whereClause = and(...conditions);

  const totalResult = await db
    .select({ value: count() })
    .from(permissions)
    .where(whereClause);

  const baseQuery = db
    .select()
    .from(permissions)
    .where(whereClause)
    .orderBy(desc(permissions.created_at));

  const rows = await (pagination
    ? baseQuery.limit(pagination.limit).offset(pagination.offset)
    : baseQuery);

  return {
    data: rows.map(mapPermission),
    total: Number(totalResult[0]?.value ?? 0),
  };
}

export async function listPendingPermissions(organizationId: string, pagination?: PaginationParams) {
  const whereClause = and(
    eq(permissions.organization_id, organizationId),
    eq(permissions.status, "pending"),
    isNull(permissions.deleted_at)
  );

  const totalResult = await db
    .select({ value: count() })
    .from(permissions)
    .where(whereClause);

  const baseQuery = db
    .select()
    .from(permissions)
    .where(whereClause)
    .orderBy(desc(permissions.created_at));

  const rows = await (pagination
    ? baseQuery.limit(pagination.limit).offset(pagination.offset)
    : baseQuery);

  return {
    data: rows.map(mapPermission),
    total: Number(totalResult[0]?.value ?? 0),
  };
}

export async function getPermission(permissionId: string, organizationId: string) {
  const rows = await db
    .select()
    .from(permissions)
    .where(
      and(
        eq(permissions.id, permissionId),
        eq(permissions.organization_id, organizationId),
        isNull(permissions.deleted_at)
      )
    )
    .limit(1);

  return rows.length ? rows[0] : null;
}

export async function updatePermission(
  permissionId: string,
  organizationId: string,
  data: UpdatePermissionData
) {
  const updates: Partial<PermissionInsert> = {
    updated_at: new Date(),
  };

  if (data.message !== undefined) updates.message = data.message;
  if (data.startingDate !== undefined) {
    updates.starting_date = data.startingDate;
  }
  if (data.endDate !== undefined) {
    updates.end_date = data.endDate;
  }

  // Validate dates if both are being updated
  if (data.startingDate !== undefined && data.endDate !== undefined) {
    if (data.endDate <= data.startingDate) {
      throw new Error("end_date must be greater than starting_date");
    }
  } else if (data.endDate !== undefined || data.startingDate !== undefined) {
    // If only one date is being updated, fetch current permission to validate
    const current = await getPermission(permissionId, organizationId);
    if (current) {
      const startDate = data.startingDate ?? current.starting_date;
      const endDate = data.endDate ?? current.end_date;
      if (endDate <= startDate) {
        throw new Error("end_date must be greater than starting_date");
      }
    }
  }

  const updated = await db
    .update(permissions)
    .set(updates)
    .where(
      and(
        eq(permissions.id, permissionId),
        eq(permissions.organization_id, organizationId),
        isNull(permissions.deleted_at)
      )
    )
    .returning();

  return updated.length ? mapPermission(updated[0]!) : null;
}

export async function cancelPermission(permissionId: string, organizationId: string) {
  const deleted = await db
    .update(permissions)
    .set({
      deleted_at: new Date(),
      updated_at: new Date(),
    })
    .where(
      and(
        eq(permissions.id, permissionId),
        eq(permissions.organization_id, organizationId),
        isNull(permissions.deleted_at)
      )
    )
    .returning();

  return deleted.length ? mapPermission(deleted[0]!) : null;
}

export async function approvePermission(
  permissionId: string,
  organizationId: string,
  data: ApprovePermissionData
) {
  const updated = await db
    .update(permissions)
    .set({
      status: "approved",
      approved_by: data.approvedBy,
      supervisor_comment: data.comment ?? null,
      updated_at: new Date(),
    })
    .where(
      and(
        eq(permissions.id, permissionId),
        eq(permissions.organization_id, organizationId),
        eq(permissions.status, "pending"),
        isNull(permissions.deleted_at)
      )
    )
    .returning();

  return updated.length ? mapPermission(updated[0]!) : null;
}

export async function rejectPermission(
  permissionId: string,
  organizationId: string,
  data: RejectPermissionData
) {
  const updated = await db
    .update(permissions)
    .set({
      status: "rejected",
      approved_by: data.approvedBy,
      supervisor_comment: data.comment,
      updated_at: new Date(),
    })
    .where(
      and(
        eq(permissions.id, permissionId),
        eq(permissions.organization_id, organizationId),
        eq(permissions.status, "pending"),
        isNull(permissions.deleted_at)
      )
    )
    .returning();

  return updated.length ? mapPermission(updated[0]!) : null;
}

export async function addDocumentToPermission(
  permissionId: string,
  organizationId: string,
  documentUrl: string
) {
  const current = await getPermission(permissionId, organizationId);
  if (!current) {
    return null;
  }

  const currentDocuments = current.documents_url ?? [];
  const updatedDocuments = [...currentDocuments, documentUrl];

  const updated = await db
    .update(permissions)
    .set({
      documents_url: updatedDocuments,
      updated_at: new Date(),
    })
    .where(
      and(
        eq(permissions.id, permissionId),
        eq(permissions.organization_id, organizationId),
        isNull(permissions.deleted_at)
      )
    )
    .returning();

  return updated.length ? mapPermission(updated[0]!) : null;
}



