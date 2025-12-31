import type { Context } from "hono";
import { ErrorCodes, errorResponse, successResponse } from "../../core/http";
import { registerPushToken, removePushToken } from "./push-notifications.service";

function isValidExpoToken(token: string) {
  return /^(Expo|Exponent)PushToken/.test(token);
}

export async function registerToken(c: Context): Promise<Response> {
  try {
    const user = c.get("user");
    const organization = c.get("organization");

    if (!user || !organization) {
      return errorResponse(c, "Authentication and organization are required", ErrorCodes.UNAUTHORIZED);
    }

    const body = await c.req.json();
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    const deviceType = body?.device_type === "ios" || body?.device_type === "android" ? body.device_type : "unknown";

    if (!token) {
      return errorResponse(c, "token is required", ErrorCodes.BAD_REQUEST);
    }

    if (!isValidExpoToken(token)) {
      return errorResponse(c, "token must be a valid Expo push token", ErrorCodes.BAD_REQUEST);
    }

    await registerPushToken({
      userId: user.id,
      organizationId: organization.id,
      token,
      deviceType,
    });

    return successResponse(c, {
      message: "Push token registered",
    });
  } catch (error) {
    console.error("registerToken error:", error);
    return errorResponse(c, "Unable to register push token", ErrorCodes.INTERNAL_SERVER_ERROR);
  }
}

export async function unregisterToken(c: Context): Promise<Response> {
  try {
    const user = c.get("user");
    if (!user) {
      return errorResponse(c, "Authentication is required", ErrorCodes.UNAUTHORIZED);
    }

    const body = await c.req.json();
    const token = typeof body?.token === "string" ? body.token.trim() : "";

    if (!token) {
      return errorResponse(c, "token is required", ErrorCodes.BAD_REQUEST);
    }

    await removePushToken(user.id, token);

    return successResponse(c, {
      message: "Push token removed",
    });
  } catch (error) {
    console.error("unregisterToken error:", error);
    return errorResponse(c, "Unable to remove push token", ErrorCodes.INTERNAL_SERVER_ERROR);
  }
}





