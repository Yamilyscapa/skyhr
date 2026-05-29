import type { Context } from "hono";
import {
  ErrorCodes,
  SuccessCodes,
  errorResponse,
  successResponse,
} from "../../core/http";
import {
  buildPaginationMetadata,
  PaginationError,
  parsePaginationParams,
} from "../../utils/pagination";
import {
  deleteUserAccount,
  getOrganizationMember,
  listOrganizationMembers,
  updateOrganizationMember,
  type UpdateMemberInput,
} from "./users.service";

export async function deleteAccount(c: Context): Promise<Response> {
  const user = c.get("user");

  if (!user) {
    return errorResponse(
      c,
      "User context is required",
      ErrorCodes.UNAUTHORIZED,
    );
  }

  try {
    const deleted = await deleteUserAccount(user.id);

    if (!deleted) {
      return errorResponse(c, "User not found", ErrorCodes.NOT_FOUND);
    }

    return successResponse(
      c,
      {
        message: "Cuenta eliminada",
      },
      SuccessCodes.OK,
    );
  } catch (error) {
    console.error("deleteAccount error:", error);
    return errorResponse(
      c,
      "Unable to delete account",
      ErrorCodes.INTERNAL_SERVER_ERROR,
    );
  }
}

export async function listMembers(c: Context): Promise<Response> {
  const organization = c.get("organization");
  if (!organization) {
    return errorResponse(c, "Organization context required", ErrorCodes.FORBIDDEN);
  }

  try {
    const pagination = parsePaginationParams(
      c.req.query("page"),
      c.req.query("pageSize"),
    );
    const search = c.req.query("search")?.trim() || undefined;
    const role = c.req.query("role")?.trim() || undefined;

    const { rows, total } = await listOrganizationMembers({
      organizationId: organization.id,
      search,
      role,
      limit: pagination.limit,
      offset: pagination.offset,
    });

    return successResponse(c, {
      data: rows,
      pagination: buildPaginationMetadata(pagination, total),
    });
  } catch (error) {
    if (error instanceof PaginationError) {
      return errorResponse(c, error.message, ErrorCodes.BAD_REQUEST);
    }
    console.error("listMembers error:", error);
    return errorResponse(
      c,
      "Unable to list members",
      ErrorCodes.INTERNAL_SERVER_ERROR,
    );
  }
}

export async function getMe(c: Context): Promise<Response> {
  const user = c.get("user");
  const organization = c.get("organization");
  if (!user || !organization) {
    return errorResponse(c, "Authentication required", ErrorCodes.UNAUTHORIZED);
  }

  try {
    const detail = await getOrganizationMember(organization.id, user.id);
    if (!detail) {
      return errorResponse(c, "Membership not found", ErrorCodes.NOT_FOUND);
    }
    return successResponse(c, { data: detail });
  } catch (error) {
    console.error("getMe error:", error);
    return errorResponse(
      c,
      "Unable to fetch user",
      ErrorCodes.INTERNAL_SERVER_ERROR,
    );
  }
}

export async function getMember(c: Context): Promise<Response> {
  const organization = c.get("organization");
  if (!organization) {
    return errorResponse(c, "Organization context required", ErrorCodes.FORBIDDEN);
  }

  const userId = c.req.param("id");
  if (!userId) {
    return errorResponse(c, "User id required", ErrorCodes.BAD_REQUEST);
  }

  try {
    const detail = await getOrganizationMember(organization.id, userId);
    if (!detail) {
      return errorResponse(c, "User not found", ErrorCodes.NOT_FOUND);
    }
    return successResponse(c, { data: detail });
  } catch (error) {
    console.error("getMember error:", error);
    return errorResponse(
      c,
      "Unable to fetch user",
      ErrorCodes.INTERNAL_SERVER_ERROR,
    );
  }
}

export async function updateMember(c: Context): Promise<Response> {
  const organization = c.get("organization");
  if (!organization) {
    return errorResponse(c, "Organization context required", ErrorCodes.FORBIDDEN);
  }

  const userId = c.req.param("id");
  if (!userId) {
    return errorResponse(c, "User id required", ErrorCodes.BAD_REQUEST);
  }

  let body: Partial<UpdateMemberInput>;
  try {
    body = await c.req.json();
  } catch {
    return errorResponse(c, "Invalid JSON body", ErrorCodes.BAD_REQUEST);
  }

  const patch: UpdateMemberInput = {};
  if (typeof body.name === "string") patch.name = body.name;
  if (body.department === null || typeof body.department === "string") {
    patch.department = body.department;
  }
  if (body.position === null || typeof body.position === "string") {
    patch.position = body.position;
  }
  if (body.hourlyRate === null || typeof body.hourlyRate === "number") {
    patch.hourlyRate = body.hourlyRate;
  }
  if (typeof body.role === "string") patch.role = body.role;

  if (Object.keys(patch).length === 0) {
    return errorResponse(c, "No updatable fields provided", ErrorCodes.BAD_REQUEST);
  }

  try {
    const updated = await updateOrganizationMember(
      organization.id,
      userId,
      patch,
    );
    if (!updated) {
      return errorResponse(c, "User not found", ErrorCodes.NOT_FOUND);
    }
    return successResponse(c, { data: updated });
  } catch (error) {
    console.error("updateMember error:", error);
    return errorResponse(
      c,
      "Unable to update user",
      ErrorCodes.INTERNAL_SERVER_ERROR,
    );
  }
}
