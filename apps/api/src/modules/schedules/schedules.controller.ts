import type { Context } from "hono";
import { ErrorCodes, errorResponse, successResponse } from "../../core/http";
import {
  createShift as createShiftService,
  getShiftsByOrganization,
  getShiftById,
  updateShift as updateShiftService,
  assignShiftToUser as assignShiftService,
  getUserSchedule,
  type CreateShiftData,
  type AssignShiftData,
} from "./schedules.service";
import {
  buildPaginationMetadata,
  PaginationError,
  parsePaginationParams,
} from "../../utils/pagination";

export async function createShift(c: Context): Promise<Response> {
  try {
    const body = await c.req.json();
    const organization = c.get("organization");

    if (!organization) {
      return errorResponse(c, "Organization is required", ErrorCodes.UNAUTHORIZED);
    }

    // Validate required fields
    if (!body.name || !body.start_time || !body.end_time || !body.days_of_week) {
      return errorResponse(
        c,
        "Missing required fields: name, start_time, end_time, days_of_week",
        ErrorCodes.BAD_REQUEST
      );
    }

    // Validate time format (HH:MM:SS)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
    if (!timeRegex.test(body.start_time) || !timeRegex.test(body.end_time)) {
      return errorResponse(
        c,
        "Invalid time format. Use HH:MM:SS or HH:MM",
        ErrorCodes.BAD_REQUEST
      );
    }

    // Ensure time has seconds
    const start_time = body.start_time.length === 5 ? `${body.start_time}:00` : body.start_time;
    const end_time = body.end_time.length === 5 ? `${body.end_time}:00` : body.end_time;

    // Validate days_of_week
    if (!Array.isArray(body.days_of_week) || body.days_of_week.length === 0) {
      return errorResponse(
        c,
        "days_of_week must be a non-empty array",
        ErrorCodes.BAD_REQUEST
      );
    }

    const validDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    const invalidDays = body.days_of_week.filter(
      (day: string) => !validDays.includes(day.toLowerCase())
    );
    if (invalidDays.length > 0) {
      return errorResponse(
        c,
        `Invalid days: ${invalidDays.join(", ")}. Valid days are: ${validDays.join(", ")}`,
        ErrorCodes.BAD_REQUEST
      );
    }

    const shiftData: CreateShiftData = {
      organization_id: organization.id,
      name: body.name,
      start_time,
      end_time,
      break_minutes: body.break_minutes || 0,
      days_of_week: body.days_of_week.map((d: string) => d.toLowerCase()),
      color: body.color,
    };

    const newShift = await createShiftService(shiftData);

    if (!newShift) {
      return errorResponse(c, "Failed to create shift", ErrorCodes.INTERNAL_SERVER_ERROR);
    }

    return successResponse(c, {
      message: "Shift created successfully",
      data: newShift,
    });
  } catch (error) {
    console.error("Create shift error:", error);
    return errorResponse(c, "Failed to create shift", ErrorCodes.INTERNAL_SERVER_ERROR);
  }
}

export async function getShifts(c: Context): Promise<Response> {
  try {
    const organization = c.get("organization");

    if (!organization) {
      return errorResponse(c, "Organization is required", ErrorCodes.UNAUTHORIZED);
    }

    const pagination = parsePaginationParams(c.req.query("page"), c.req.query("pageSize"));

    const { shifts, total } = await getShiftsByOrganization(organization.id, pagination);

    return successResponse(c, {
      message: "Shifts retrieved successfully",
      data: shifts,
      pagination: buildPaginationMetadata(pagination, total),
    });
  } catch (error) {
    console.error("Get shifts error:", error);
    if (error instanceof PaginationError) {
      return errorResponse(c, error.message, ErrorCodes.BAD_REQUEST);
    }
    return errorResponse(c, "Failed to retrieve shifts", ErrorCodes.INTERNAL_SERVER_ERROR);
  }
}

export async function updateShift(c: Context): Promise<Response> {
  try {
    const shiftId = c.req.param("id");
    const body = await c.req.json();
    const organization = c.get("organization");

    if (!organization) {
      return errorResponse(c, "Organization is required", ErrorCodes.UNAUTHORIZED);
    }

    if (!shiftId) {
      return errorResponse(c, "Shift ID is required", ErrorCodes.BAD_REQUEST);
    }

    // Verify shift belongs to organization
    const existingShift = await getShiftById(shiftId);
    if (!existingShift) {
      return errorResponse(c, "Shift not found", ErrorCodes.NOT_FOUND);
    }

    if (existingShift.organization_id !== organization.id) {
      return errorResponse(c, "Unauthorized to update this shift", ErrorCodes.FORBIDDEN);
    }

    // Validate time format if provided
    if (body.start_time || body.end_time) {
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
      if (body.start_time && !timeRegex.test(body.start_time)) {
        return errorResponse(c, "Invalid start_time format", ErrorCodes.BAD_REQUEST);
      }
      if (body.end_time && !timeRegex.test(body.end_time)) {
        return errorResponse(c, "Invalid end_time format", ErrorCodes.BAD_REQUEST);
      }
    }

    // Ensure time has seconds
    if (body.start_time && body.start_time.length === 5) {
      body.start_time = `${body.start_time}:00`;
    }
    if (body.end_time && body.end_time.length === 5) {
      body.end_time = `${body.end_time}:00`;
    }

    // Validate days_of_week if provided
    if (body.days_of_week) {
      if (!Array.isArray(body.days_of_week) || body.days_of_week.length === 0) {
        return errorResponse(
          c,
          "days_of_week must be a non-empty array",
          ErrorCodes.BAD_REQUEST
        );
      }
      body.days_of_week = body.days_of_week.map((d: string) => d.toLowerCase());
    }

    const updatedShift = await updateShiftService(shiftId, body);

    if (!updatedShift) {
      return errorResponse(c, "Failed to update shift", ErrorCodes.INTERNAL_SERVER_ERROR);
    }

    return successResponse(c, {
      message: "Shift updated successfully",
      data: updatedShift,
    });
  } catch (error) {
    console.error("Update shift error:", error);
    return errorResponse(c, "Failed to update shift", ErrorCodes.INTERNAL_SERVER_ERROR);
  }
}

export async function assignShiftToUser(c: Context): Promise<Response> {
  try {
    const body = await c.req.json();
    const organization = c.get("organization");

    if (!organization) {
      return errorResponse(c, "Organization is required", ErrorCodes.UNAUTHORIZED);
    }

    // Validate required fields
    if (!body.user_id || !body.shift_id || !body.effective_from) {
      return errorResponse(
        c,
        "Missing required fields: user_id, shift_id, effective_from",
        ErrorCodes.BAD_REQUEST
      );
    }

    // Verify shift belongs to organization
    const existingShift = await getShiftById(body.shift_id);
    if (!existingShift) {
      return errorResponse(c, "Shift not found", ErrorCodes.NOT_FOUND);
    }

    if (existingShift.organization_id !== organization.id) {
      return errorResponse(c, "Shift does not belong to this organization", ErrorCodes.FORBIDDEN);
    }

    const assignmentData: AssignShiftData = {
      user_id: body.user_id,
      shift_id: body.shift_id,
      organization_id: organization.id,
      effective_from: new Date(body.effective_from),
      effective_until: body.effective_until ? new Date(body.effective_until) : null,
    };

    const assignment = await assignShiftService(assignmentData);

    if (!assignment) {
      return errorResponse(c, "Failed to assign shift", ErrorCodes.INTERNAL_SERVER_ERROR);
    }

    return successResponse(c, {
      message: "Shift assigned successfully",
      data: assignment,
    });
  } catch (error) {
    console.error("Assign shift error:", error);
    return errorResponse(c, "Failed to assign shift", ErrorCodes.INTERNAL_SERVER_ERROR);
  }
}

export async function getUserScheduleController(c: Context): Promise<Response> {
  try {
    const userId = c.req.param("userId");
    const organization = c.get("organization");

    if (!organization) {
      return errorResponse(c, "Organization is required", ErrorCodes.UNAUTHORIZED);
    }

    if (!userId) {
      return errorResponse(c, "User ID is required", ErrorCodes.BAD_REQUEST);
    }

    const schedule = await getUserSchedule(userId, organization.id);

    return successResponse(c, {
      message: "User schedule retrieved successfully",
      data: schedule,
    });
  } catch (error) {
    console.error("Get user schedule error:", error);
    return errorResponse(c, "Failed to retrieve user schedule", ErrorCodes.INTERNAL_SERVER_ERROR);
  }
}
