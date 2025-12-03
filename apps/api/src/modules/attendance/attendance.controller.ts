import type { Context } from "hono";
import { successResponse, errorResponse, ErrorCodes } from "../../core/http";
import {
  parseQrPayload,
  findActiveGeofence,
  createAttendanceEvent,
  validateGeofenceLocation,
  calculateAttendanceStatus,
  findExistingCheckIn,
  findTodayAttendance,
  updateCheckOut,
  updateAttendanceStatus as updateStatusService,
  markAbsentUsers,
} from "./attendance.service";
import { searchFacesByImageForOrganization, detectLiveness } from "../biometrics/biometrics.service";
import { rekognitionSettings } from "../../config/rekognition";
import { db } from "../../db";
import { attendance_event, member, organization, users } from "../../db/schema";
import { and, count, desc, eq, gte, lte, or } from "drizzle-orm";
import {
  buildPaginationMetadata,
  PaginationError,
  parsePaginationParams,
} from "../../utils/pagination";

export async function validateQr(c: Context): Promise<Response> {
  try {
    const body = await c.req.json();
    const qrData = body?.qr_data as string;
    if (!qrData) return errorResponse(c, "qr_data is required", ErrorCodes.BAD_REQUEST);

    const organization = c.get("organization");
    if (!organization) return errorResponse(c, "Organization is required", ErrorCodes.UNAUTHORIZED);

    const payload = parseQrPayload(qrData);
    if (payload.organization_id !== organization.id) {
      return errorResponse(c, "QR does not belong to active organization", ErrorCodes.FORBIDDEN);
    }

    const gf = await findActiveGeofence(payload.location_id, organization.id);
    if (!gf) return errorResponse(c, "Location not allowed or inactive", ErrorCodes.FORBIDDEN);

    return successResponse(c, {
      message: "QR valid",
      data: { location_id: gf.id, organization_id: organization.id },
    });
  } catch (e) {
    return errorResponse(c, "Invalid or malformed QR", ErrorCodes.BAD_REQUEST);
  }
}

export async function checkIn(c: Context): Promise<Response> {
  try {
    const body = await c.req.json();
    const organizationId = body?.organization_id as string;
    const locationId = body?.location_id as string;
    const imageBase64 = body?.image as string;
    const latitude = body?.latitude as string;
    const longitude = body?.longitude as string;

    if (!organizationId || !locationId || !imageBase64) {
      return errorResponse(c, "organization_id, location_id, and image (base64) are required", ErrorCodes.BAD_REQUEST);
    }

    if (!latitude || !longitude) {
      return errorResponse(c, "latitude and longitude are required for geofence validation", ErrorCodes.BAD_REQUEST);
    }

    const user = c.get("user");
    if (!user) {
      return errorResponse(c, "Unauthorized", ErrorCodes.UNAUTHORIZED);
    }

    // 1) Validate user belongs to the specified organization
    const userMembership = await db
      .select()
      .from(member)
      .where(and(eq(member.userId, user.id), eq(member.organizationId, organizationId)))
      .limit(1);

    if (!userMembership || userMembership.length === 0) {
      return errorResponse(c, "User does not belong to the specified organization", ErrorCodes.FORBIDDEN);
    }

    // 2) Get organization details
    const orgDetails = await db
      .select()
      .from(organization)
      .where(eq(organization.id, organizationId))
      .limit(1);

    if (!orgDetails || orgDetails.length === 0) {
      return errorResponse(c, "Organization not found", ErrorCodes.NOT_FOUND);
    }

    const orgData = orgDetails[0];

    // 3) Validate location belongs to organization and is active
    const gf = await findActiveGeofence(locationId, organizationId);
    if (!gf) {
      return errorResponse(c, "Location not allowed or inactive", ErrorCodes.FORBIDDEN);
    }

    // Validate geofence has required properties
    if (!gf.center_latitude || !gf.center_longitude || gf.radius === null) {
      return errorResponse(c, "Geofence configuration is incomplete", ErrorCodes.INTERNAL_SERVER_ERROR);
    }

    // 2) Validate geofence location
    const userLat = parseFloat(latitude);
    const userLon = parseFloat(longitude);

    if (isNaN(userLat) || isNaN(userLon)) {
      return errorResponse(c, "Invalid latitude or longitude", ErrorCodes.BAD_REQUEST);
    }

    const { isWithin, distance } = validateGeofenceLocation(userLat, userLon, {
      center_latitude: gf.center_latitude,
      center_longitude: gf.center_longitude,
      radius: gf.radius,
    });

    // 4) Check for duplicate check-in today
    const existingCheckIn = await findExistingCheckIn(user.id, new Date(), organizationId);
    if (existingCheckIn) {
      return errorResponse(
        c,
        "You already have an active check-in today. Please check out first.",
        ErrorCodes.BAD_REQUEST
      );
    }

    // 5) Biometric verification (search within org)
    // Convert base64 string to Buffer
    let imageBuffer: Buffer;
    try {
      // Handle both with and without data URL prefix (data:image/jpeg;base64,...)
      const base64Data = imageBase64.includes(",") 
        ? (imageBase64.split(",")[1] || imageBase64) 
        : imageBase64;
      imageBuffer = Buffer.from(base64Data, "base64");
    } catch (e) {
      return errorResponse(c, "Invalid base64 image format", ErrorCodes.BAD_REQUEST);
    }
    const matches = await searchFacesByImageForOrganization(imageBuffer, organizationId);
    
    // Debug logging
    console.log(`[checkIn] Face search results:`, {
      matchesCount: matches?.length ?? 0,
      threshold: rekognitionSettings.similarityThreshold,
      matches: matches?.map(m => ({
        externalImageId: m.Face?.ExternalImageId,
        similarity: m.Similarity,
        confidence: m.Face?.Confidence
      })) ?? []
    });
    
    // Find the match for the current user (not just the first/highest similarity match)
    const userMatch = matches?.find(m => m.Face?.ExternalImageId === user.id);
    const externalImageId = userMatch?.Face?.ExternalImageId;
    const similarity = userMatch?.Similarity ?? 0;

    console.log(`[checkIn] User match:`, {
      hasMatch: !!userMatch,
      externalImageId,
      expectedUserId: user.id,
      similarity,
      threshold: rekognitionSettings.similarityThreshold
    });

    if (!userMatch || externalImageId !== user.id) {
      console.log(`[checkIn] Face match failed:`, {
        hasMatch: !!userMatch,
        externalImageId,
        expectedUserId: user.id,
        allMatches: matches?.map(m => m.Face?.ExternalImageId) ?? []
      });
      return errorResponse(c, "Face does not match the current user", ErrorCodes.FORBIDDEN);
    }

    // Validate similarity meets the configured threshold
    if (similarity < rekognitionSettings.similarityThreshold) {
      console.log(`[checkIn] Similarity below threshold:`, {
        similarity,
        threshold: rekognitionSettings.similarityThreshold
      });
      return errorResponse(
        c,
        `Face similarity (${similarity.toFixed(1)}%) is below the required threshold (${rekognitionSettings.similarityThreshold}%)`,
        ErrorCodes.FORBIDDEN
      );
    }

    console.log(`[checkIn] Face verification passed:`, {
      similarity,
      threshold: rekognitionSettings.similarityThreshold
    });

    // 6) Liveness detection to detect potential photo/print spoofing
    const livenessResult = await detectLiveness(imageBuffer);
    
    console.log(`[checkIn] Liveness detection result:`, {
      isLive: livenessResult.isLive,
      livenessScore: livenessResult.livenessScore,
      spoofFlag: livenessResult.spoofFlag,
      reasons: livenessResult.reasons
    });

    // 7) Calculate attendance status based on shift
    const checkInTime = new Date();
    const { status: baseStatus, shiftId, notes: statusNotes } = await calculateAttendanceStatus(
      checkInTime,
      user.id,
      organizationId
    );

    // If out of geofence bounds, override status
    let finalStatus = baseStatus;
    let notes = statusNotes;

    if (!isWithin) {
      finalStatus = "out_of_bounds";
      notes = `Check-in ${distance}m from geofence (radius: ${gf.radius}m). ${statusNotes || ""}`.trim();
    }

    // 8) Create attendance event with full metadata
    // Use the validated geofence ID automatically
    const record = await createAttendanceEvent({
      userId: user.id,
      organizationId: organizationId,
      locationId: gf.id, // Automatically use the validated geofence ID
      shiftId,
      status: finalStatus,
      isWithinGeofence: isWithin,
      distanceToGeofence: distance,
      latitude,
      longitude,
      faceConfidence: String(similarity),
      livenessScore: String(livenessResult.livenessScore),
      spoofFlag: livenessResult.spoofFlag,
      notes,
    });

    if (!record) {
      return errorResponse(c, "Failed to create attendance record", ErrorCodes.INTERNAL_SERVER_ERROR);
    }

    return successResponse(c, {
      message: !isWithin
        ? "Attendance recorded but flagged as out of bounds"
        : "Attendance recorded successfully",
      data: {
        id: record.id,
        check_in: record.check_in,
        user_id: record.user_id,
        organization_id: record.organization_id,
        location_id: record.location_id,
        shift_id: record.shift_id,
        status: record.status,
        is_within_geofence: record.is_within_geofence,
        distance_to_geofence_m: record.distance_to_geofence_m,
        face_confidence: record.face_confidence,
        is_verified: record.is_verified,
        notes: record.notes,
      },
    });
  } catch (e) {
    console.error("Check-in error:", e);
    return errorResponse(c, "Attendance check-in failed", ErrorCodes.INTERNAL_SERVER_ERROR);
  }
}

export async function watchModeCheckIn(c: Context): Promise<Response> {
  try {
    const body = await c.req.json();
    const organizationId = body?.organization_id as string;
    const locationId = body?.location_id as string;
    const imageBase64 = body?.image as string;
    const latitude = body?.latitude as string;
    const longitude = body?.longitude as string;

    if (!organizationId || !locationId || !imageBase64) {
      return errorResponse(c, "organization_id, location_id, and image (base64) are required", ErrorCodes.BAD_REQUEST);
    }

    if (!latitude || !longitude) {
      return errorResponse(c, "latitude and longitude are required for geofence validation", ErrorCodes.BAD_REQUEST);
    }

    const organization = c.get("organization");
    if (!organization || organization.id !== organizationId) {
      return errorResponse(c, "Organization mismatch for watch mode", ErrorCodes.FORBIDDEN);
    }

    const gf = await findActiveGeofence(locationId, organizationId);
    if (!gf) {
      return errorResponse(c, "Location not allowed or inactive", ErrorCodes.FORBIDDEN);
    }

    if (!gf.center_latitude || !gf.center_longitude || gf.radius === null) {
      return errorResponse(c, "Geofence configuration is incomplete", ErrorCodes.INTERNAL_SERVER_ERROR);
    }

    const userLat = parseFloat(latitude);
    const userLon = parseFloat(longitude);
    if (isNaN(userLat) || isNaN(userLon)) {
      return errorResponse(c, "Invalid latitude or longitude", ErrorCodes.BAD_REQUEST);
    }

    const { isWithin, distance } = validateGeofenceLocation(userLat, userLon, {
      center_latitude: gf.center_latitude,
      center_longitude: gf.center_longitude,
      radius: gf.radius,
    });

    let imageBuffer: Buffer;
    try {
      const base64Data = imageBase64.includes(",")
        ? (imageBase64.split(",")[1] || imageBase64)
        : imageBase64;
      imageBuffer = Buffer.from(base64Data, "base64");
    } catch (e) {
      return errorResponse(c, "Invalid base64 image format", ErrorCodes.BAD_REQUEST);
    }

    const matches = await searchFacesByImageForOrganization(imageBuffer, organizationId);
    const sortedMatches = (matches ?? []).sort((a, b) => {
      const similarityA = a?.Similarity ?? 0;
      const similarityB = b?.Similarity ?? 0;
      return similarityB - similarityA;
    });

    const bestMatch = sortedMatches.find((match) => {
      const similarity = match?.Similarity ?? 0;
      const externalImageId = match?.Face?.ExternalImageId;
      return Boolean(externalImageId) && similarity >= rekognitionSettings.similarityThreshold;
    });

    if (!bestMatch || !bestMatch.Face?.ExternalImageId) {
      return errorResponse(c, "No matching user found for this face", ErrorCodes.NOT_FOUND);
    }

    const matchedUserId = bestMatch.Face.ExternalImageId;
    const matchedUsers = await db
      .select()
      .from(users)
      .where(eq(users.id, matchedUserId))
      .limit(1);

    const matchedUser = matchedUsers[0];
    if (!matchedUser) {
      return errorResponse(c, "Matched user not found", ErrorCodes.NOT_FOUND);
    }

    const membership = await db
      .select()
      .from(member)
      .where(and(eq(member.userId, matchedUserId), eq(member.organizationId, organizationId)))
      .limit(1);

    if (!membership || membership.length === 0) {
      return errorResponse(c, "Matched user is not part of this organization", ErrorCodes.FORBIDDEN);
    }

    const existingCheckIn = await findExistingCheckIn(matchedUserId, new Date(), organizationId);
    if (existingCheckIn) {
      return errorResponse(
        c,
        `El colaborador ${matchedUser.name} ya tiene un registro activo hoy.`,
        ErrorCodes.BAD_REQUEST
      );
    }

    const livenessResult = await detectLiveness(imageBuffer);
    const checkInTime = new Date();
    const { status: baseStatus, shiftId, notes: statusNotes } = await calculateAttendanceStatus(
      checkInTime,
      matchedUserId,
      organizationId
    );

    let finalStatus = baseStatus;
    let notes = statusNotes;

    if (!isWithin) {
      finalStatus = "out_of_bounds";
      notes = `Check-in ${distance}m from geofence (radius: ${gf.radius}m). ${statusNotes || ""}`.trim();
    }

    const record = await createAttendanceEvent({
      userId: matchedUserId,
      organizationId,
      locationId: gf.id,
      shiftId,
      status: finalStatus,
      isWithinGeofence: isWithin,
      distanceToGeofence: distance,
      latitude,
      longitude,
      faceConfidence: String(bestMatch.Similarity ?? 0),
      livenessScore:
        livenessResult.livenessScore !== null && livenessResult.livenessScore !== undefined
          ? String(livenessResult.livenessScore)
          : null,
      spoofFlag: livenessResult.spoofFlag,
      notes,
      source: "watch_mode",
    });

    if (!record) {
      return errorResponse(c, "Failed to create attendance record", ErrorCodes.INTERNAL_SERVER_ERROR);
    }

    return successResponse(c, {
      message: !isWithin
        ? "Attendance recorded in watch mode but flagged as out of bounds"
        : "Attendance recorded successfully in watch mode",
      data: {
        event: {
          id: record.id,
          check_in: record.check_in,
          user_id: record.user_id,
          organization_id: record.organization_id,
          location_id: record.location_id,
          shift_id: record.shift_id,
          status: record.status,
          is_within_geofence: record.is_within_geofence,
          distance_to_geofence_m: record.distance_to_geofence_m,
          face_confidence: record.face_confidence,
          liveness_score: record.liveness_score,
          spoof_flag: record.spoof_flag,
          source: record.source,
        },
        user: {
          id: matchedUser.id,
          name: matchedUser.name,
          email: matchedUser.email,
          image: matchedUser.image,
        },
        similarity: bestMatch.Similarity ?? null,
        liveness: livenessResult,
      },
    });
  } catch (error) {
    console.error("Watch mode check-in error:", error);
    return errorResponse(c, "Watch mode check-in failed", ErrorCodes.INTERNAL_SERVER_ERROR);
  }
}

export async function checkOut(c: Context): Promise<Response> {
  try {
    const form = await c.req.formData();
    const latitude = form.get("latitude") as string;
    const longitude = form.get("longitude") as string;

    if (!latitude || !longitude) {
      return errorResponse(c, "latitude and longitude are required for geofence validation", ErrorCodes.BAD_REQUEST);
    }

    const user = c.get("user");
    const organization = c.get("organization");
    if (!user || !organization) {
      return errorResponse(c, "Unauthorized", ErrorCodes.UNAUTHORIZED);
    }

    // Find today's active check-in (no check-out yet)
    const activeCheckIn = await findExistingCheckIn(user.id, new Date(), organization.id);

    if (!activeCheckIn) {
      return errorResponse(
        c,
        "No active check-in found. Please check in first.",
        ErrorCodes.BAD_REQUEST
      );
    }

    // Get the geofence from the check-in record
    if (!activeCheckIn.latitude || !activeCheckIn.longitude) {
      return errorResponse(c, "Check-in location data missing", ErrorCodes.INTERNAL_SERVER_ERROR);
    }

    // For check-out, we validate against the same geofence as check-in
    // Get geofence from database using distance calculation
    const userLat = parseFloat(latitude);
    const userLon = parseFloat(longitude);

    if (isNaN(userLat) || isNaN(userLon)) {
      return errorResponse(c, "Invalid latitude or longitude", ErrorCodes.BAD_REQUEST);
    }

    // We need to find the geofence - we can get it from the attendance event's organization
    // For now, let's allow check-out anywhere but flag if out of bounds
    // In a real implementation, you'd store geofence_id in attendance_event

    const checkOutTime = new Date();
    
    // Update the check-out
    const updated = await updateCheckOut(
      activeCheckIn.id,
      checkOutTime,
      true, // For now, assume within bounds for check-out
      activeCheckIn.distance_to_geofence_m ?? undefined
    );

    if (!updated) {
      return errorResponse(c, "Failed to update check-out", ErrorCodes.INTERNAL_SERVER_ERROR);
    }

    // Calculate work duration
    const workDurationMs = checkOutTime.getTime() - activeCheckIn.check_in.getTime();
    const workDurationMinutes = Math.floor(workDurationMs / 60000);

    return successResponse(c, {
      message: "Check-out recorded successfully",
      data: {
        id: updated.id,
        check_in: updated.check_in,
        check_out: updated.check_out,
        work_duration_minutes: workDurationMinutes,
        status: updated.status,
        is_verified: updated.is_verified,
      },
    });
  } catch (e) {
    console.error("Check-out error:", e);
    return errorResponse(c, "Attendance check-out failed", ErrorCodes.INTERNAL_SERVER_ERROR);
  }
}

export async function markAbsences(c: Context): Promise<Response> {
  try {
    const organization = c.get("organization");

    if (!organization) {
      return errorResponse(c, "Organization is required", ErrorCodes.UNAUTHORIZED);
    }

    const absences = await markAbsentUsers(organization.id);

    return successResponse(c, {
      message: `Marked ${absences.length} user(s) as absent`,
      data: {
        count: absences.length,
        absences: absences.map((a) => ({
          id: a.id,
          user_id: a.user_id,
          shift_id: a.shift_id,
          notes: a.notes,
        })),
      },
    });
  } catch (e) {
    console.error("Mark absences error:", e);
    return errorResponse(c, "Failed to mark absences", ErrorCodes.INTERNAL_SERVER_ERROR);
  }
}

export async function updateAttendanceStatusController(c: Context): Promise<Response> {
  try {
    const eventId = c.req.param("eventId");
    const body = await c.req.json();
    const organization = c.get("organization");

    if (!organization) {
      return errorResponse(c, "Organization is required", ErrorCodes.UNAUTHORIZED);
    }

    if (!eventId) {
      return errorResponse(c, "Event ID is required", ErrorCodes.BAD_REQUEST);
    }

    if (!body.status) {
      return errorResponse(c, "Status is required", ErrorCodes.BAD_REQUEST);
    }

    // Verify event belongs to organization
    const events = await db
      .select()
      .from(attendance_event)
      .where(and(eq(attendance_event.id, eventId), eq(attendance_event.organization_id, organization.id)))
      .limit(1);

    if (events.length === 0) {
      return errorResponse(c, "Attendance event not found", ErrorCodes.NOT_FOUND);
    }

    // Validate status
    const validStatuses = ["on_time", "late", "early", "absent", "out_of_bounds"];
    if (!validStatuses.includes(body.status)) {
      return errorResponse(
        c,
        `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
        ErrorCodes.BAD_REQUEST
      );
    }

    const updated = await updateStatusService(eventId, body.status, body.notes);

    if (!updated) {
      return errorResponse(c, "Failed to update attendance status", ErrorCodes.INTERNAL_SERVER_ERROR);
    }

    return successResponse(c, {
      message: "Attendance status updated successfully",
      data: {
        id: updated.id,
        status: updated.status,
        notes: updated.notes,
        updated_at: updated.updated_at,
      },
    });
  } catch (e) {
    console.error("Update status error:", e);
    return errorResponse(c, "Failed to update attendance status", ErrorCodes.INTERNAL_SERVER_ERROR);
  }
}

export async function getTodayAttendance(c: Context): Promise<Response> {
  try {
    const userId = c.req.param("userId");
    const organization = c.get("organization");

    if (!organization) {
      return errorResponse(c, "Organization is required", ErrorCodes.UNAUTHORIZED);
    }

    if (!userId) {
      return errorResponse(c, "User ID is required", ErrorCodes.BAD_REQUEST);
    }

    const todayAttendance = await findTodayAttendance(userId, organization.id);

    if (!todayAttendance) {
      return errorResponse(c, "Today's attendance event not found", ErrorCodes.NOT_FOUND);
    }
    
    return successResponse(c, {
      message: "Today's attendance event retrieved successfully",
      data: todayAttendance,
    });
  } catch (e) {
    console.error("Get attendance event by user ID error:", e);
    return errorResponse(c, "Failed to retrieve attendance event", ErrorCodes.INTERNAL_SERVER_ERROR);
  }
}

export async function getAttendanceEvents(c: Context): Promise<Response> {
  try {
    const organization = c.get("organization");

    if (!organization) {
      return errorResponse(c, "Organization is required", ErrorCodes.UNAUTHORIZED);
    }

    const pagination = parsePaginationParams(c.req.query("page"), c.req.query("pageSize"));

    // Get query parameters for filtering
    const userId = c.req.query("user_id");
    const startDate = c.req.query("start_date");
    const endDate = c.req.query("end_date");
    const status = c.req.query("status");

    // Build query conditions
    const conditions = [eq(attendance_event.organization_id, organization.id)];

    // Filter by user if provided, otherwise return all events for organization
    if (userId) {
      conditions.push(eq(attendance_event.user_id, userId));
    }

    // Filter by date range if provided
    if (startDate) {
      const start = new Date(startDate);
      conditions.push(gte(attendance_event.check_in, start));
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(attendance_event.check_in, end));
    }

    // Filter by status if provided
    if (status) {
      conditions.push(eq(attendance_event.status, status));
    }

    const whereClause = and(...conditions);

    const totalResult = await db
      .select({ value: count() })
      .from(attendance_event)
      .where(whereClause);

    const total = Number(totalResult[0]?.value ?? 0);

    const events = await db
      .select()
      .from(attendance_event)
      .where(whereClause)
      .orderBy(desc(attendance_event.check_in))
      .limit(pagination.limit)
      .offset(pagination.offset);

    return successResponse(c, {
      message: "Attendance events retrieved successfully",
      data: events.map((event) => ({
        id: event.id,
        user_id: event.user_id,
        organization_id: event.organization_id,
        location_id: event.location_id,
        check_in: event.check_in,
        check_out: event.check_out,
        status: event.status,
        is_verified: event.is_verified,
        is_within_geofence: event.is_within_geofence,
        distance_to_geofence_m: event.distance_to_geofence_m,
        latitude: event.latitude,
        longitude: event.longitude,
        source: event.source,
        face_confidence: event.face_confidence,
        liveness_score: event.liveness_score,
        spoof_flag: event.spoof_flag,
        shift_id: event.shift_id,
        notes: event.notes,
        created_at: event.created_at,
        updated_at: event.updated_at,
      })),
      pagination: buildPaginationMetadata(pagination, total),
    });
  } catch (e) {
    if (e instanceof PaginationError) {
      return errorResponse(c, e.message, ErrorCodes.BAD_REQUEST);
    }
    console.error("Get attendance events error:", e);
    return errorResponse(c, "Failed to retrieve attendance events", ErrorCodes.INTERNAL_SERVER_ERROR);
  }
}

export async function getAttendanceReport(c: Context): Promise<Response> {
  try {
    const organization = c.get("organization");

    if (!organization) {
      return errorResponse(c, "Organization is required", ErrorCodes.UNAUTHORIZED);
    }

    // Get flagged events (out_of_bounds, absent, late)
    const flaggedEvents = await db
      .select()
      .from(attendance_event)
      .where(
        and(
          eq(attendance_event.organization_id, organization.id),
          or(
            eq(attendance_event.status, "out_of_bounds"),
            eq(attendance_event.status, "absent"),
            eq(attendance_event.status, "late")
          )
        )
      );

    return successResponse(c, {
      message: "Attendance report retrieved successfully",
      data: {
        flagged_count: flaggedEvents.length,
        flagged_events: flaggedEvents.map((event) => ({
          id: event.id,
          user_id: event.user_id,
          check_in: event.check_in,
          check_out: event.check_out,
          status: event.status,
          is_within_geofence: event.is_within_geofence,
          distance_to_geofence_m: event.distance_to_geofence_m,
          shift_id: event.shift_id,
          notes: event.notes,
        })),
      },
    });
  } catch (e) {
    console.error("Get report error:", e);
    return errorResponse(c, "Failed to retrieve attendance report", ErrorCodes.INTERNAL_SERVER_ERROR);
  }
}
