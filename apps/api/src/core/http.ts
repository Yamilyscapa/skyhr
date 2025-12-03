import type { Context } from "hono";

export const SuccessCodes = {
    OK: 200,
    CREATED: 201,
    ACCEPTED: 202,
    NON_AUTHORITATIVE_INFORMATION: 203,
    MULTI_STATUS: 207,
    ALREADY_REPORTED: 208,
    IM_USED: 226,
} as const;

export const ErrorCodes = {
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    INTERNAL_SERVER_ERROR: 500,
} as const;

type SuccessCode = typeof SuccessCodes[keyof typeof SuccessCodes];
type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

export function successResponse(c: Context, data: any, code: SuccessCode = SuccessCodes.OK) {
    return c.json(data, code);
}

export function errorResponse(c: Context, message: string, code: ErrorCode = ErrorCodes.BAD_REQUEST, details?: any) {
    const errorData = {
        error: message,
        ...(details && { details }),
    };
    return c.json(errorData, code);
}
