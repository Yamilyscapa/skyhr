import type { Context } from "hono";
import { ErrorCodes, SuccessCodes, errorResponse, successResponse } from "../../core/http";
import {
  buildPaginationMetadata,
  PaginationError,
  parsePaginationParams,
} from "../../utils/pagination";
import {
  ANNOUNCEMENT_PRIORITIES,
  createAnnouncement as createAnnouncementService,
  deleteAnnouncement as deleteAnnouncementService,
  getAnnouncement as getAnnouncementService,
  isAnnouncementActive,
  listAnnouncements,
  mapAnnouncement,
  updateAnnouncement as updateAnnouncementService,
} from "./announcements.service";

const ADMIN_ROLES = ["owner", "admin"];

function isValidPriority(value: string): value is typeof ANNOUNCEMENT_PRIORITIES[number] {
  return (ANNOUNCEMENT_PRIORITIES as readonly string[]).includes(value);
}

function parseDate(value: unknown) {
  if (!value) return null;
  const date = new Date(value as string);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function isAdminRole(role?: string | null) {
  return !!role && ADMIN_ROLES.includes(role);
}

export async function createAnnouncement(c: Context): Promise<Response> {
  try {
    const organization = c.get("organization");
    if (!organization) {
      return errorResponse(c, "Organization context is required", ErrorCodes.UNAUTHORIZED);
    }

    const body = await c.req.json();
    const title = (body?.title ?? "").trim();
    const content = (body?.content ?? "").trim();
    const priority = typeof body?.priority === "string" ? body.priority : "normal";

    if (!title) {
      return errorResponse(c, "title is required", ErrorCodes.BAD_REQUEST);
    }

    if (!content) {
      return errorResponse(c, "content is required", ErrorCodes.BAD_REQUEST);
    }

    if (!isValidPriority(priority)) {
      return errorResponse(
        c,
        `priority must be one of: ${ANNOUNCEMENT_PRIORITIES.join(", ")}`,
        ErrorCodes.BAD_REQUEST
      );
    }

    const publishedAt = parseDate(body?.published_at) ?? new Date();
    const expiresAt = body?.expires_at ? parseDate(body.expires_at) : null;

    if (expiresAt && expiresAt <= publishedAt) {
      return errorResponse(
        c,
        "expires_at must be greater than published_at",
        ErrorCodes.BAD_REQUEST
      );
    }

    const created = await createAnnouncementService({
      organizationId: organization.id,
      title,
      content,
      priority,
      publishedAt,
      expiresAt,
    });

    if (!created) {
      return errorResponse(c, "Failed to create announcement", ErrorCodes.INTERNAL_SERVER_ERROR);
    }

    return successResponse(
      c,
      {
        message: "Announcement created successfully",
        data: created,
      },
      SuccessCodes.CREATED
    );
  } catch (error) {
    console.error("createAnnouncement error:", error);
    return errorResponse(c, "Unable to create announcement", ErrorCodes.INTERNAL_SERVER_ERROR);
  }
}

export async function getAnnouncements(c: Context): Promise<Response> {
  try {
    const organization = c.get("organization");
    const member = c.get("member");

    if (!organization) {
      return errorResponse(c, "Organization context is required", ErrorCodes.UNAUTHORIZED);
    }

    const admin = isAdminRole(member?.role);
    const includeExpired = admin && c.req.query("includeExpired") === "true";
    const includeFuture = admin && c.req.query("includeFuture") === "true";

    const pagination = parsePaginationParams(c.req.query("page"), c.req.query("pageSize"));

    const { data, total } = await listAnnouncements(
      organization.id,
      {
        includeExpired,
        includeFuture,
      },
      pagination
    );

    return successResponse(c, {
      message: "Announcements retrieved successfully",
      data: data,
      pagination: buildPaginationMetadata(pagination, total),
    });
  } catch (error) {
    if (error instanceof PaginationError) {
      return errorResponse(c, error.message, ErrorCodes.BAD_REQUEST);
    }
    console.error("getAnnouncements error:", error);
    return errorResponse(c, "Unable to fetch announcements", ErrorCodes.INTERNAL_SERVER_ERROR);
  }
}

export async function getAnnouncementById(c: Context): Promise<Response> {
  try {
    const organization = c.get("organization");
    const member = c.get("member");

    if (!organization) {
      return errorResponse(c, "Organization context is required", ErrorCodes.UNAUTHORIZED);
    }

    const id = c.req.param("id");
    if (!id) {
      return errorResponse(c, "Announcement id is required", ErrorCodes.BAD_REQUEST);
    }

    const row = await getAnnouncementService(id, organization.id);
    if (!row) {
      return errorResponse(c, "Announcement not found", ErrorCodes.NOT_FOUND);
    }

    if (!isAdminRole(member?.role) && !isAnnouncementActive(row)) {
      return errorResponse(c, "Announcement not found", ErrorCodes.NOT_FOUND);
    }

    return successResponse(c, {
      message: "Announcement retrieved successfully",
      data: mapAnnouncement(row),
    });
  } catch (error) {
    console.error("getAnnouncementById error:", error);
    return errorResponse(c, "Unable to fetch announcement", ErrorCodes.INTERNAL_SERVER_ERROR);
  }
}

export async function updateAnnouncement(c: Context): Promise<Response> {
  try {
    const organization = c.get("organization");
    if (!organization) {
      return errorResponse(c, "Organization context is required", ErrorCodes.UNAUTHORIZED);
    }

    const id = c.req.param("id");
    if (!id) {
      return errorResponse(c, "Announcement id is required", ErrorCodes.BAD_REQUEST);
    }

    const existing = await getAnnouncementService(id, organization.id);
    if (!existing) {
      return errorResponse(c, "Announcement not found", ErrorCodes.NOT_FOUND);
    }

    const body = await c.req.json();
    const payload: {
      title?: string;
      content?: string;
      priority?: typeof ANNOUNCEMENT_PRIORITIES[number];
      publishedAt?: Date;
      expiresAt?: Date | null;
    } = {};

    if ("title" in body) {
      const title = (body.title ?? "").trim();
      if (!title) {
        return errorResponse(c, "title cannot be empty", ErrorCodes.BAD_REQUEST);
      }
      payload.title = title;
    }

    if ("content" in body) {
      const content = (body.content ?? "").trim();
      if (!content) {
        return errorResponse(c, "content cannot be empty", ErrorCodes.BAD_REQUEST);
      }
      payload.content = content;
    }

    if ("priority" in body) {
      const priorityValue = String(body.priority);
      if (!isValidPriority(priorityValue)) {
        return errorResponse(
          c,
          `priority must be one of: ${ANNOUNCEMENT_PRIORITIES.join(", ")}`,
          ErrorCodes.BAD_REQUEST
        );
      }
      payload.priority = priorityValue;
    }

    let publishedAt = existing.published_at;
    if ("published_at" in body) {
      const parsed = parseDate(body.published_at);
      if (!parsed) {
        return errorResponse(c, "published_at must be a valid date", ErrorCodes.BAD_REQUEST);
      }
      payload.publishedAt = parsed;
      publishedAt = parsed;
    }

    if ("expires_at" in body) {
      const parsed = body.expires_at ? parseDate(body.expires_at) : null;
      if (body.expires_at && !parsed) {
        return errorResponse(c, "expires_at must be a valid date", ErrorCodes.BAD_REQUEST);
      }
      payload.expiresAt = parsed;
      if (parsed && parsed <= (payload.publishedAt ?? publishedAt)) {
        return errorResponse(
          c,
          "expires_at must be greater than published_at",
          ErrorCodes.BAD_REQUEST
        );
      }
    }

    if (Object.keys(payload).length === 0) {
      return errorResponse(
        c,
        "At least one field (title, content, priority, published_at, expires_at) must be provided",
        ErrorCodes.BAD_REQUEST
      );
    }

    const updated = await updateAnnouncementService(id, organization.id, payload);

    if (!updated) {
      return errorResponse(c, "Failed to update announcement", ErrorCodes.INTERNAL_SERVER_ERROR);
    }

    return successResponse(c, {
      message: "Announcement updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error("updateAnnouncement error:", error);
    return errorResponse(c, "Unable to update announcement", ErrorCodes.INTERNAL_SERVER_ERROR);
  }
}

export async function deleteAnnouncement(c: Context): Promise<Response> {
  try {
    const organization = c.get("organization");
    if (!organization) {
      return errorResponse(c, "Organization context is required", ErrorCodes.UNAUTHORIZED);
    }

    const id = c.req.param("id");
    if (!id) {
      return errorResponse(c, "Announcement id is required", ErrorCodes.BAD_REQUEST);
    }

    const deleted = await deleteAnnouncementService(id, organization.id);

    if (!deleted) {
      return errorResponse(c, "Announcement not found", ErrorCodes.NOT_FOUND);
    }

    return successResponse(c, {
      message: "Announcement deleted successfully",
      data: deleted,
    });
  } catch (error) {
    console.error("deleteAnnouncement error:", error);
    return errorResponse(c, "Unable to delete announcement", ErrorCodes.INTERNAL_SERVER_ERROR);
  }
}
