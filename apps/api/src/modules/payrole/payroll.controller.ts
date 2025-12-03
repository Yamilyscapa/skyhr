import type { Context } from "hono";
import { errorResponse, successResponse, ErrorCodes, SuccessCodes } from "../../core/http";
import { updateUserPayroll as updateUserPayrollService, getUserPayroll as getUserPayrollService, allowOvertime as allowOvertimeService, getOvertime as getOvertimeService } from "./payrole.service";

/**
 * Add a user payroll (POST request)
 * @param c - The context object
 * @returns The response object
 */
export async function updateUserPayroll(c: Context): Promise<Response> {
    try {
        const body = await c.req.json();
        const { user_id, hourly_rate }: { user_id: string; hourly_rate: number } = body;

        if (!user_id) {
            return errorResponse(c, "User ID is required", ErrorCodes.BAD_REQUEST);
        }

        const result = await updateUserPayrollService({
            userId: user_id,
            hourlyRate: hourly_rate,
        });

        return successResponse(c, {
            message: "User hourly rate updated successfully",
            data: {
                user_id: result.userId,
                hourly_rate: result.hourlyRate,
            },
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to update user hourly rate";

        if (errorMessage === "User not found") {
            return errorResponse(c, errorMessage, ErrorCodes.NOT_FOUND);
        }

        if (errorMessage.includes("required") || errorMessage.includes("must be greater")) {
            return errorResponse(c, errorMessage, ErrorCodes.BAD_REQUEST);
        }

        return errorResponse(c, errorMessage, ErrorCodes.INTERNAL_SERVER_ERROR);
    }
}

export async function getUserPayroll(c: Context): Promise<Response> {
    try {
        const user_id = c.req.param("userId");

        if (!user_id) {
            return errorResponse(c, "User ID is required", ErrorCodes.BAD_REQUEST);
        }

        const result = await getUserPayrollService(user_id);

        if (!result) {
            return errorResponse(c, "User payroll not found", ErrorCodes.NOT_FOUND);
        }

        return successResponse(c, {
            message: "User payroll retrieved successfully",
            data: result,
        });
    } catch (error) {
        return errorResponse(c, "Failed to retrieve user payroll", ErrorCodes.INTERNAL_SERVER_ERROR);
    }
}

// Overtime (PUT request)
export async function allowOvertime(c: Context): Promise<Response> {
    try {
        const body = await c.req.json();
        const user_id = c.req.param("userId");
        const { overtime_allowed }: { overtime_allowed: boolean } = body;

        if (!user_id) {
            return errorResponse(c, "User ID is required", ErrorCodes.BAD_REQUEST);
        }

        if (typeof overtime_allowed !== "boolean") {
            return errorResponse(c, "Overtime allowed is required", ErrorCodes.BAD_REQUEST);
        }

        await allowOvertimeService(user_id, overtime_allowed);

        return successResponse(c, {
            message: "Overtime allowed successfully",
            data: { user_id: user_id, overtime_allowed: overtime_allowed },
        });
    } catch (error) {
        return errorResponse(c, "Failed to allow overtime", ErrorCodes.INTERNAL_SERVER_ERROR);
    }
}

export async function getOvertime(c: Context): Promise<Response> {
    try {
        const user_id = c.req.param("userId");

        if (!user_id) {
            return errorResponse(c, "User ID is required", ErrorCodes.BAD_REQUEST);
        }

        const result = await getOvertimeService(user_id);

        return successResponse(c, {
            message: "Overtime retrieved successfully",
            data: { user_id: user_id, overtime_allowed: result },
        });
    } catch (error) {
        return errorResponse(c, "Failed to get overtime", ErrorCodes.INTERNAL_SERVER_ERROR);
    }
}
