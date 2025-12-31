import { db } from "../../db";
import { attendance_event, geofence, organization_settings } from "../../db/schema";
import { and, eq, gte, isNull, desc } from "drizzle-orm";
import { deobfuscateJsonPayload } from "../../utils/obfuscation";
import { getUserActiveShift, parseTimeToToday, getUsersWithActiveShifts } from "../schedules/schedules.service";

export type QrPayload = { organization_id: string; location_id: string };

export type CreateAttendanceEventArgs = {
  userId: string;
  organizationId: string;
  locationId?: string | null;
  shiftId?: string | null;
  status: string;
  isWithinGeofence: boolean;
  distanceToGeofence?: number;
  latitude?: string | null;
  longitude?: string | null;
  faceConfidence?: string | null;
  livenessScore?: string | null;
  spoofFlag?: boolean;
  notes?: string | null;
  source?: string;
};

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const lookup: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      lookup[part.type] = Number(part.value);
    }
  }
  return {
    year: lookup.year ?? date.getUTCFullYear(),
    month: lookup.month ?? date.getUTCMonth() + 1,
    day: lookup.day ?? date.getUTCDate(),
    hour: lookup.hour ?? 0,
    minute: lookup.minute ?? 0,
    second: lookup.second ?? 0,
  };
}

function resolveTimeZone(rawTimeZone?: string | null): string {
  const fallback = "America/Mexico_City";
  const candidate = (rawTimeZone ?? "").trim();
  if (!candidate) return fallback;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format();
    return candidate;
  } catch {
    return fallback;
  }
}

export function getQrSecret(): string {
  const raw = process.env.QR_SECRET;
  if (!raw) return "skyhr-secret-2024";
  try {
    return Buffer.from(raw, "base64").toString("utf8");
  } catch {
    return raw;
  }
}

export function parseQrPayload(qrData: string): QrPayload {
  const secret = getQrSecret();
  return deobfuscateJsonPayload<QrPayload>(qrData, secret);
}

export async function findActiveGeofence(locationId: string, orgId: string) {
  const rows = await db
    .select()
    .from(geofence)
    .where(and(eq(geofence.id, locationId), eq(geofence.organization_id, orgId), eq(geofence.active, true)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Calculate Haversine distance between two points in meters
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const EARTH_RADIUS_METERS = 6371000;

  const toRadians = (degrees: number): number => degrees * (Math.PI / 180);

  const lat1Radians = toRadians(lat1);
  const lat2Radians = toRadians(lat2);
  const latDifferenceRadians = toRadians(lat2 - lat1);
  const lonDifferenceRadians = toRadians(lon2 - lon1);

  const a =
    Math.sin(latDifferenceRadians / 2) * Math.sin(latDifferenceRadians / 2) +
    Math.cos(lat1Radians) *
      Math.cos(lat2Radians) *
      Math.sin(lonDifferenceRadians / 2) *
      Math.sin(lonDifferenceRadians / 2);

  const angularDistance = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * angularDistance;
}

/**
 * Validate if user is within geofence boundaries
 */
export function validateGeofenceLocation(
  latitude: number,
  longitude: number,
  geofence: {
    center_latitude: string;
    center_longitude: string;
    radius: number;
  }
): { isWithin: boolean; distance: number } {
  const TOLERANCE_METERS = 2;
  const distance = calculateHaversineDistance(
    latitude,
    longitude,
    parseFloat(geofence.center_latitude),
    parseFloat(geofence.center_longitude)
  );

  return {
    isWithin: distance <= geofence.radius + TOLERANCE_METERS,
    distance: Math.round(distance),
  };
}

/**
 * Calculate attendance status based on check-in time and shift schedule
 */
export async function calculateAttendanceStatus(
  checkInTime: Date,
  userId: string,
  organizationId: string
): Promise<{ status: string; shiftId: string | null; notes: string | null }> {
  // Get user's active shift for today
  const shift = await getUserActiveShift(userId, checkInTime);

  if (!shift) {
    return {
      status: "on_time",
      shiftId: null,
      notes: "No shift assigned for this day",
    };
  }

  // Get organization grace period
  const settings = await getOrganizationSettings(organizationId);
  const gracePeriodMinutes = settings?.grace_period_minutes ?? 5;
  const timeZone = resolveTimeZone(settings?.timezone);

  // Compare using organization-local time-of-day to avoid date skew
  const checkInParts = getZonedParts(checkInTime, timeZone);
  const [shiftStartHour = 0, shiftStartMinute = 0, shiftStartSecond = 0] =
    shift.start_time.split(":").map(Number);
  const [shiftEndHour = 0, shiftEndMinute = 0, shiftEndSecond = 0] =
    shift.end_time.split(":").map(Number);
  const shiftStartMinutes =
    shiftStartHour * 60 + shiftStartMinute + (shiftStartSecond || 0) / 60;
  const shiftEndMinutes =
    shiftEndHour * 60 + shiftEndMinute + (shiftEndSecond || 0) / 60;
  let checkInMinutes =
    checkInParts.hour * 60 + checkInParts.minute + checkInParts.second / 60;

  // Handle overnight shifts (e.g., 22:00-06:00)
  if (shiftEndMinutes <= shiftStartMinutes && checkInMinutes < shiftStartMinutes) {
    checkInMinutes += 24 * 60;
  }

  const diffMinutes = checkInMinutes - shiftStartMinutes;

  let status: string;
  if (diffMinutes < -gracePeriodMinutes) {
    status = "early";
  } else if (diffMinutes <= gracePeriodMinutes) {
    status = "on_time";
  } else {
    status = "late";
  }

  return {
    status,
    shiftId: shift.id,
    notes: null,
  };
}

/**
 * Get organization settings
 */
export async function getOrganizationSettings(organizationId: string) {
  const rows = await db
    .select()
    .from(organization_settings)
    .where(eq(organization_settings.organization_id, organizationId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Create or ensure organization settings exist
 */
export async function ensureOrganizationSettings(organizationId: string) {
  const existing = await getOrganizationSettings(organizationId);
  if (existing) return existing;

  const inserted = await db
    .insert(organization_settings)
    .values({
      organization_id: organizationId,
      grace_period_minutes: 5,
      extra_hour_cost: 0,
      timezone: "America/Mexico_City",
    })
    .returning();
  return inserted[0];
}

/**
 * Find existing check-in for user today (no check-out yet)
 */
export async function findExistingCheckIn(
  userId: string,
  date: Date,
  organizationId: string
) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const rows = await db
    .select()
    .from(attendance_event)
    .where(
      and(
        eq(attendance_event.user_id, userId),
        eq(attendance_event.organization_id, organizationId),
        gte(attendance_event.check_in, startOfDay),
        isNull(attendance_event.check_out)
      )
    )
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Find the most recent attendance event for user today
 */
export async function findTodayAttendance(
  userId: string,
  organizationId: string
) {
  const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);

  const rows = await db
    .select()
    .from(attendance_event)
    .where(
      and(
        eq(attendance_event.user_id, userId),
        eq(attendance_event.organization_id, organizationId),
        gte(attendance_event.check_in, startOfDay)
      )
    )
    .orderBy(desc(attendance_event.check_in))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Create attendance event with all metadata
 */
export async function createAttendanceEvent(args: CreateAttendanceEventArgs) {
  const {
    userId,
    organizationId,
    locationId,
    shiftId,
    status,
    isWithinGeofence,
    distanceToGeofence,
    latitude,
    longitude,
    faceConfidence,
    livenessScore,
    spoofFlag,
    notes,
    source,
  } = args;

  const inserted = await db
    .insert(attendance_event)
    .values({
      user_id: userId,
      organization_id: organizationId,
      location_id: locationId ?? null,
      shift_id: shiftId ?? null,
      check_in: new Date(),
      check_out: null,
      status,
      is_within_geofence: isWithinGeofence,
      is_verified: true,
      source: source ?? "qr_face",
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      distance_to_geofence_m: distanceToGeofence ?? null,
      face_confidence: faceConfidence ?? null,
      liveness_score: livenessScore ?? null,
      spoof_flag: spoofFlag ?? false,
      notes: notes ?? null,
    })
    .returning();
  return inserted[0];
}

/**
 * Update check-out time for attendance event
 */
export async function updateCheckOut(
  eventId: string,
  checkOutTime: Date,
  isWithinGeofence: boolean,
  distanceToGeofence?: number
) {
  const updated = await db
    .update(attendance_event)
    .set({
      check_out: checkOutTime,
      is_within_geofence: isWithinGeofence,
      distance_to_geofence_m: distanceToGeofence ?? null,
      updated_at: new Date(),
    })
    .where(eq(attendance_event.id, eventId))
    .returning();
  return updated[0];
}

/**
 * Update attendance status (admin action)
 */
export async function updateAttendanceStatus(
  eventId: string,
  newStatus: string,
  notes?: string
) {
  const updated = await db
    .update(attendance_event)
    .set({
      status: newStatus,
      notes: notes ?? null,
      updated_at: new Date(),
    })
    .where(eq(attendance_event.id, eventId))
    .returning();
  return updated[0];
}

/**
 * Mark absent users who haven't checked in within grace period
 */
export async function markAbsentUsers(organizationId: string) {
  const now = new Date();
  const settings = await getOrganizationSettings(organizationId);
  const gracePeriodMinutes = settings?.grace_period_minutes ?? 5;

  // Get all users with active shifts today
  const usersWithShifts = await getUsersWithActiveShifts(organizationId, now);

  const absentUsers: Array<{ userId: string; shiftId: string; shiftStartTime: string }> = [];

  for (const { schedule, shift } of usersWithShifts) {
    const shiftStart = parseTimeToToday(shift.start_time);
    const graceEndTime = new Date(shiftStart.getTime() + gracePeriodMinutes * 60000);

    // If grace period has passed and no check-in exists
    if (now > graceEndTime) {
      const existingCheckIn = await findExistingCheckIn(
        schedule.user_id,
        now,
        organizationId
      );

      if (!existingCheckIn) {
        absentUsers.push({
          userId: schedule.user_id,
          shiftId: shift.id,
          shiftStartTime: shift.start_time,
        });
      }
    }
  }

  // Create absence records
  const absenceRecords = [];
  for (const absent of absentUsers) {
    const record = await db
      .insert(attendance_event)
      .values({
        user_id: absent.userId,
        organization_id: organizationId,
        shift_id: absent.shiftId,
        check_in: now,
        check_out: null,
        status: "absent",
        is_within_geofence: false,
        is_verified: false,
        source: "system",
        notes: `Auto-marked absent. Expected shift start: ${absent.shiftStartTime}`,
      })
      .returning();
    
    if (record[0]) {
      absenceRecords.push(record[0]);
    }
  }

  return absenceRecords;
}
