import type { Context } from "hono";
import { ErrorCodes, SuccessCodes, errorResponse, successResponse } from "../../core/http";
import {
  buildPaginationMetadata,
  PaginationError,
  parsePaginationParams,
} from "../../utils/pagination";
import {
  PERMISSION_STATUSES,
  createPermission as createPermissionService,
  getPermission as getPermissionService,
  listPermissions,
  listPendingPermissions,
  updatePermission as updatePermissionService,
  cancelPermission as cancelPermissionService,
  approvePermission as approvePermissionService,
  rejectPermission as rejectPermissionService,
  addDocumentToPermission,
  mapPermission,
  canModifyPermission,
  isAdminOrOwner,
} from "./permissions.service";
import { createStorageService } from "../storage/storage.service";
import { createMulterAdapter } from "../storage/adapters/multer-adapter";
import { createS3Adapter } from "../storage/adapters/s3-adapter";
import { storagePolicies } from "../storage/storage.policies";

const ADMIN_ROLES = ["owner", "admin"];

const storageAdapter = process.env.NODE_ENV === "development" || !process.env.NODE_ENV
  ? createMulterAdapter()
  : createS3Adapter();
const storageService = createStorageService(storageAdapter);

function isValidStatus(value: string): value is typeof PERMISSION_STATUSES[number] {
  return (PERMISSION_STATUSES as readonly string[]).includes(value);
}

function parseDate(value: unknown) {
  if (!value) return null;
  const date = new Date(value as string);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export async function createPermission(c: Context): Promise<Response> {
  try {
    const organization = c.get("organization");
    const user = c.get("user");

    if (!organization) {
      return errorResponse(c, "Organization context is required", ErrorCodes.UNAUTHORIZED);
    }

    if (!user) {
      return errorResponse(c, "User context is required", ErrorCodes.UNAUTHORIZED);
    }

    const body = await c.req.parseBody();
    const message = (body?.message ?? "").trim();

    if (!message) {
      return errorResponse(c, "message is required", ErrorCodes.BAD_REQUEST);
    }

    const startingDate = parseDate(body?.starting_date);
    const endDate = parseDate(body?.end_date);

    if (!startingDate) {
      return errorResponse(c, "starting_date is required and must be a valid date", ErrorCodes.BAD_REQUEST);
    }

    if (!endDate) {
      return errorResponse(c, "end_date is required and must be a valid date", ErrorCodes.BAD_REQUEST);
    }

    if (endDate <= startingDate) {
      return errorResponse(
        c,
        "end_date must be greater than starting_date",
        ErrorCodes.BAD_REQUEST
      );
    }

    // Handle document upload (single file during creation)
    let documentUrl: string | undefined;
    const file = body?.document;
    
    if (file && file instanceof File) {
      const policies = storagePolicies();
      const fileType = file.type;
      const fileSize = file.size;

      if (!policies.permissionDocument.allowedTypes.includes(fileType)) {
        return errorResponse(
          c,
          `File type not allowed. Only images and PDF are supported.`,
          ErrorCodes.BAD_REQUEST
        );
      }

      if (fileSize > policies.permissionDocument.maxSize) {
        return errorResponse(
          c,
          `File size exceeds maximum allowed size of ${policies.permissionDocument.maxSize / (1024 * 1024)}MB`,
          ErrorCodes.BAD_REQUEST
        );
      }

      // Create permission first to get ID for proper file naming
      const created = await createPermissionService({
        userId: user.id,
        organizationId: organization.id,
        message,
        startingDate,
        endDate,
        documentsUrl: [],
      });

      if (!created) {
        return errorResponse(c, "Failed to create permission", ErrorCodes.INTERNAL_SERVER_ERROR);
      }

      // Upload document with permission ID
      try {
        const uploadResult = await storageService.uploadPermissionDocument(
          file,
          created.id,
          0
        );
        documentUrl = uploadResult.url;

        // Update permission with document URL
        const updated = await addDocumentToPermission(
          created.id,
          organization.id,
          documentUrl
        );

        if (!updated) {
          // Permission created but document upload failed - return the permission without document
          console.warn("Permission created but document could not be added");
          return successResponse(
            c,
            {
              message: "Permission created successfully (document upload failed)",
              data: created,
            },
            SuccessCodes.CREATED
          );
        }

        return successResponse(
          c,
          {
            message: "Permission created successfully",
            data: updated,
          },
          SuccessCodes.CREATED
        );
      } catch (uploadError) {
        // Permission created but document upload failed - return the permission without document
        console.error("Document upload failed:", uploadError);
        return successResponse(
          c,
          {
            message: "Permission created successfully (document upload failed)",
            data: created,
          },
          SuccessCodes.CREATED
        );
      }
    } else {
      // No document, create permission without document
      const created = await createPermissionService({
        userId: user.id,
        organizationId: organization.id,
        message,
        startingDate,
        endDate,
        documentsUrl: [],
      });

      if (!created) {
        return errorResponse(c, "Failed to create permission", ErrorCodes.INTERNAL_SERVER_ERROR);
      }

      return successResponse(
        c,
        {
          message: "Permission created successfully",
          data: created,
        },
        SuccessCodes.CREATED
      );
    }
  } catch (error) {
    console.error("createPermission error:", error);
    if (error instanceof Error && error.message.includes("end_date")) {
      return errorResponse(c, error.message, ErrorCodes.BAD_REQUEST);
    }
    return errorResponse(c, "Unable to create permission", ErrorCodes.INTERNAL_SERVER_ERROR);
  }
}

export async function getPermissions(c: Context): Promise<Response> {
  try {
    const organization = c.get("organization");
    const member = c.get("member");
    const user = c.get("user");

    if (!organization) {
      return errorResponse(c, "Organization context is required", ErrorCodes.UNAUTHORIZED);
    }

    if (!user) {
      return errorResponse(c, "User context is required", ErrorCodes.UNAUTHORIZED);
    }

    const filters: { status?: string; userId?: string } = {};
    const statusParam = c.req.query("status");
    const userIdParam = c.req.query("userId");

    if (statusParam && isValidStatus(statusParam)) {
      filters.status = statusParam;
    }

    if (userIdParam && isAdminOrOwner(member?.role)) {
      filters.userId = userIdParam;
    }

    const pagination = parsePaginationParams(c.req.query("page"), c.req.query("pageSize"));

    const { data, total } = await listPermissions(
      organization.id,
      filters,
      pagination,
      user.id,
      member?.role
    );

    return successResponse(c, {
      message: "Permissions retrieved successfully",
      data: data,
      pagination: buildPaginationMetadata(pagination, total),
    });
  } catch (error) {
    if (error instanceof PaginationError) {
      return errorResponse(c, error.message, ErrorCodes.BAD_REQUEST);
    }
    console.error("getPermissions error:", error);
    return errorResponse(c, "Unable to fetch permissions", ErrorCodes.INTERNAL_SERVER_ERROR);
  }
}

export async function getPendingRequests(c: Context): Promise<Response> {
  try {
    const organization = c.get("organization");
    const member = c.get("member");

    if (!organization) {
      return errorResponse(c, "Organization context is required", ErrorCodes.UNAUTHORIZED);
    }

    if (!isAdminOrOwner(member?.role)) {
      return errorResponse(c, "Access denied. Admin or Owner role required.", ErrorCodes.FORBIDDEN);
    }

    const pagination = parsePaginationParams(c.req.query("page"), c.req.query("pageSize"));

    const { data, total } = await listPendingPermissions(organization.id, pagination);

    return successResponse(c, {
      message: "Pending permissions retrieved successfully",
      data: data,
      pagination: buildPaginationMetadata(pagination, total),
    });
  } catch (error) {
    if (error instanceof PaginationError) {
      return errorResponse(c, error.message, ErrorCodes.BAD_REQUEST);
    }
    console.error("getPendingRequests error:", error);
    return errorResponse(c, "Unable to fetch pending permissions", ErrorCodes.INTERNAL_SERVER_ERROR);
  }
}

export async function getPermissionById(c: Context): Promise<Response> {
  try {
    const organization = c.get("organization");
    const member = c.get("member");
    const user = c.get("user");

    if (!organization) {
      return errorResponse(c, "Organization context is required", ErrorCodes.UNAUTHORIZED);
    }

    if (!user) {
      return errorResponse(c, "User context is required", ErrorCodes.UNAUTHORIZED);
    }

    const id = c.req.param("id");
    if (!id) {
      return errorResponse(c, "Permission id is required", ErrorCodes.BAD_REQUEST);
    }

    const row = await getPermissionService(id, organization.id);
    if (!row) {
      return errorResponse(c, "Permission not found", ErrorCodes.NOT_FOUND);
    }

    // Check access: user can see own permissions, admin/owner can see all
    if (!isAdminOrOwner(member?.role) && row.user_id !== user.id) {
      return errorResponse(c, "Permission not found", ErrorCodes.NOT_FOUND);
    }

    return successResponse(c, {
      message: "Permission retrieved successfully",
      data: mapPermission(row),
    });
  } catch (error) {
    console.error("getPermissionById error:", error);
    return errorResponse(c, "Unable to fetch permission", ErrorCodes.INTERNAL_SERVER_ERROR);
  }
}

export async function updatePermission(c: Context): Promise<Response> {
  try {
    const organization = c.get("organization");
    const user = c.get("user");

    if (!organization) {
      return errorResponse(c, "Organization context is required", ErrorCodes.UNAUTHORIZED);
    }

    if (!user) {
      return errorResponse(c, "User context is required", ErrorCodes.UNAUTHORIZED);
    }

    const id = c.req.param("id");
    if (!id) {
      return errorResponse(c, "Permission id is required", ErrorCodes.BAD_REQUEST);
    }

    const existing = await getPermissionService(id, organization.id);
    if (!existing) {
      return errorResponse(c, "Permission not found", ErrorCodes.NOT_FOUND);
    }

    const member = c.get("member");
    if (!canModifyPermission(existing, user.id, member?.role)) {
      return errorResponse(
        c,
        "You can only modify your own pending permissions",
        ErrorCodes.FORBIDDEN
      );
    }

    const body = await c.req.json();
    const payload: {
      message?: string;
      startingDate?: Date;
      endDate?: Date;
    } = {};

    if ("message" in body) {
      const message = (body.message ?? "").trim();
      if (!message) {
        return errorResponse(c, "message cannot be empty", ErrorCodes.BAD_REQUEST);
      }
      payload.message = message;
    }

    if ("starting_date" in body) {
      const parsed = parseDate(body.starting_date);
      if (!parsed) {
        return errorResponse(c, "starting_date must be a valid date", ErrorCodes.BAD_REQUEST);
      }
      payload.startingDate = parsed;
    }

    if ("end_date" in body) {
      const parsed = parseDate(body.end_date);
      if (!parsed) {
        return errorResponse(c, "end_date must be a valid date", ErrorCodes.BAD_REQUEST);
      }
      payload.endDate = parsed;
    }

    // Validate dates
    const startDate = payload.startingDate ?? existing.starting_date;
    const endDate = payload.endDate ?? existing.end_date;
    if (endDate <= startDate) {
      return errorResponse(
        c,
        "end_date must be greater than starting_date",
        ErrorCodes.BAD_REQUEST
      );
    }

    if (Object.keys(payload).length === 0) {
      return errorResponse(
        c,
        "At least one field (message, starting_date, end_date) must be provided",
        ErrorCodes.BAD_REQUEST
      );
    }

    const updated = await updatePermissionService(id, organization.id, payload);

    if (!updated) {
      return errorResponse(c, "Failed to update permission", ErrorCodes.INTERNAL_SERVER_ERROR);
    }

    return successResponse(c, {
      message: "Permission updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error("updatePermission error:", error);
    if (error instanceof Error && error.message.includes("end_date")) {
      return errorResponse(c, error.message, ErrorCodes.BAD_REQUEST);
    }
    return errorResponse(c, "Unable to update permission", ErrorCodes.INTERNAL_SERVER_ERROR);
  }
}

export async function cancelPermission(c: Context): Promise<Response> {
  try {
    const organization = c.get("organization");
    const user = c.get("user");

    if (!organization) {
      return errorResponse(c, "Organization context is required", ErrorCodes.UNAUTHORIZED);
    }

    if (!user) {
      return errorResponse(c, "User context is required", ErrorCodes.UNAUTHORIZED);
    }

    const id = c.req.param("id");
    if (!id) {
      return errorResponse(c, "Permission id is required", ErrorCodes.BAD_REQUEST);
    }

    const existing = await getPermissionService(id, organization.id);
    if (!existing) {
      return errorResponse(c, "Permission not found", ErrorCodes.NOT_FOUND);
    }

    const member = c.get("member");
    if (!canModifyPermission(existing, user.id, member?.role)) {
      return errorResponse(
        c,
        "You can only cancel your own pending permissions",
        ErrorCodes.FORBIDDEN
      );
    }

    const deleted = await cancelPermissionService(id, organization.id);

    if (!deleted) {
      return errorResponse(c, "Failed to cancel permission", ErrorCodes.INTERNAL_SERVER_ERROR);
    }

    return successResponse(c, {
      message: "Permission cancelled successfully",
      data: deleted,
    });
  } catch (error) {
    console.error("cancelPermission error:", error);
    return errorResponse(c, "Unable to cancel permission", ErrorCodes.INTERNAL_SERVER_ERROR);
  }
}

export async function approvePermission(c: Context): Promise<Response> {
  try {
    const organization = c.get("organization");
    const user = c.get("user");
    const member = c.get("member");

    if (!organization) {
      return errorResponse(c, "Organization context is required", ErrorCodes.UNAUTHORIZED);
    }

    if (!user) {
      return errorResponse(c, "User context is required", ErrorCodes.UNAUTHORIZED);
    }

    if (!isAdminOrOwner(member?.role)) {
      return errorResponse(c, "Access denied. Admin or Owner role required.", ErrorCodes.FORBIDDEN);
    }

    const id = c.req.param("id");
    if (!id) {
      return errorResponse(c, "Permission id is required", ErrorCodes.BAD_REQUEST);
    }

    const existing = await getPermissionService(id, organization.id);
    if (!existing) {
      return errorResponse(c, "Permission not found", ErrorCodes.NOT_FOUND);
    }

    if (existing.status !== "pending") {
      return errorResponse(
        c,
        "Only pending permissions can be approved",
        ErrorCodes.BAD_REQUEST
      );
    }

    const body = await c.req.json();
    const comment = body?.comment ? String(body.comment).trim() : undefined;

    const approved = await approvePermissionService(id, organization.id, {
      approvedBy: user.id,
      comment,
    });

    if (!approved) {
      return errorResponse(c, "Failed to approve permission", ErrorCodes.INTERNAL_SERVER_ERROR);
    }

    return successResponse(c, {
      message: "Permission approved successfully",
      data: approved,
    });
  } catch (error) {
    console.error("approvePermission error:", error);
    return errorResponse(c, "Unable to approve permission", ErrorCodes.INTERNAL_SERVER_ERROR);
  }
}

export async function rejectPermission(c: Context): Promise<Response> {
  try {
    const organization = c.get("organization");
    const user = c.get("user");
    const member = c.get("member");

    if (!organization) {
      return errorResponse(c, "Organization context is required", ErrorCodes.UNAUTHORIZED);
    }

    if (!user) {
      return errorResponse(c, "User context is required", ErrorCodes.UNAUTHORIZED);
    }

    if (!isAdminOrOwner(member?.role)) {
      return errorResponse(c, "Access denied. Admin or Owner role required.", ErrorCodes.FORBIDDEN);
    }

    const id = c.req.param("id");
    if (!id) {
      return errorResponse(c, "Permission id is required", ErrorCodes.BAD_REQUEST);
    }

    const existing = await getPermissionService(id, organization.id);
    if (!existing) {
      return errorResponse(c, "Permission not found", ErrorCodes.NOT_FOUND);
    }

    if (existing.status !== "pending") {
      return errorResponse(
        c,
        "Only pending permissions can be rejected",
        ErrorCodes.BAD_REQUEST
      );
    }

    const body = await c.req.json();
    const comment = body?.comment ? String(body.comment).trim() : "";

    if (!comment) {
      return errorResponse(c, "comment is required when rejecting a permission", ErrorCodes.BAD_REQUEST);
    }

    const rejected = await rejectPermissionService(id, organization.id, {
      approvedBy: user.id,
      comment,
    });

    if (!rejected) {
      return errorResponse(c, "Failed to reject permission", ErrorCodes.INTERNAL_SERVER_ERROR);
    }

    return successResponse(c, {
      message: "Permission rejected successfully",
      data: rejected,
    });
  } catch (error) {
    console.error("rejectPermission error:", error);
    return errorResponse(c, "Unable to reject permission", ErrorCodes.INTERNAL_SERVER_ERROR);
  }
}

export async function uploadDocuments(c: Context): Promise<Response> {
  try {
    const organization = c.get("organization");
    const user = c.get("user");

    if (!organization) {
      return errorResponse(c, "Organization context is required", ErrorCodes.UNAUTHORIZED);
    }

    if (!user) {
      return errorResponse(c, "User context is required", ErrorCodes.UNAUTHORIZED);
    }

    const id = c.req.param("id");
    if (!id) {
      return errorResponse(c, "Permission id is required", ErrorCodes.BAD_REQUEST);
    }

    const existing = await getPermissionService(id, organization.id);
    if (!existing) {
      return errorResponse(c, "Permission not found", ErrorCodes.NOT_FOUND);
    }

    const member = c.get("member");
    if (!canModifyPermission(existing, user.id, member?.role)) {
      return errorResponse(
        c,
        "You can only add documents to your own pending permissions",
        ErrorCodes.FORBIDDEN
      );
    }

    const body = await c.req.parseBody();
    const files = Array.isArray(body?.documents) ? body.documents : body?.documents ? [body.documents] : [];

    if (files.length === 0) {
      return errorResponse(c, "At least one document is required", ErrorCodes.BAD_REQUEST);
    }

    const policies = storagePolicies();
    const uploadedUrls: string[] = [];
    const currentDocuments = existing.documents_url ?? [];
    let documentIndex = currentDocuments.length;

    for (const file of files) {
      if (!(file instanceof File)) {
        return errorResponse(c, "All files must be valid File objects", ErrorCodes.BAD_REQUEST);
      }

      const fileType = file.type;
      const fileSize = file.size;

      if (!policies.permissionDocument.allowedTypes.includes(fileType)) {
        return errorResponse(
          c,
          `File type not allowed. Only images and PDF are supported.`,
          ErrorCodes.BAD_REQUEST
        );
      }

      if (fileSize > policies.permissionDocument.maxSize) {
        return errorResponse(
          c,
          `File size exceeds maximum allowed size of ${policies.permissionDocument.maxSize / (1024 * 1024)}MB`,
          ErrorCodes.BAD_REQUEST
        );
      }

      try {
        const uploadResult = await storageService.uploadPermissionDocument(
          file,
          id,
          documentIndex
        );
        uploadedUrls.push(uploadResult.url);
        documentIndex++;
      } catch (uploadError) {
        console.error("Document upload failed:", uploadError);
        return errorResponse(
          c,
          "Failed to upload document",
          ErrorCodes.INTERNAL_SERVER_ERROR
        );
      }
    }

    // Add all uploaded URLs to the permission
    let updated = existing;
    for (const url of uploadedUrls) {
      const result = await addDocumentToPermission(id, organization.id, url);
      if (result) {
        updated = result;
      }
    }

    return successResponse(c, {
      message: "Documents uploaded successfully",
      data: mapPermission(updated),
    });
  } catch (error) {
    console.error("uploadDocuments error:", error);
    return errorResponse(c, "Unable to upload documents", ErrorCodes.INTERNAL_SERVER_ERROR);
  }
}

