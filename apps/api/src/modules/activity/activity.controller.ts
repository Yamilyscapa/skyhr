import type { Context } from "hono";
import { ErrorCodes, errorResponse, successResponse } from "../../core/http";
import { listRecentActivity } from "./activity.service";

export async function getActivityFeed(c: Context): Promise<Response> {
  const organization = c.get("organization");
  if (!organization) {
    return errorResponse(c, "Organization context required", ErrorCodes.FORBIDDEN);
  }

  const limitParam = c.req.query("limit");
  const parsedLimit = limitParam ? Number(limitParam) : 20;
  if (!Number.isFinite(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
    return errorResponse(c, "limit must be between 1 and 100", ErrorCodes.BAD_REQUEST);
  }

  try {
    const items = await listRecentActivity(organization.id, parsedLimit);
    return successResponse(c, { data: items });
  } catch (error) {
    console.error("getActivityFeed error:", error);
    return errorResponse(c, "Failed to load activity feed", ErrorCodes.INTERNAL_SERVER_ERROR);
  }
}
