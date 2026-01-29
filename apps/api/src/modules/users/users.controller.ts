import type { Context } from "hono";
import {
  ErrorCodes,
  SuccessCodes,
  errorResponse,
  successResponse,
} from "../../core/http";
import { deleteUserAccount } from "./users.service";

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
