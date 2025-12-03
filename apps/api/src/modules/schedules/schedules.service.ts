import { db } from "../../db";
import { shift, user_schedule } from "../../db/schema";
import { and, count, desc, eq, gte, isNull, lte, or } from "drizzle-orm";
import type { PaginationParams } from "../../utils/pagination";

export type CreateShiftData = {
  organization_id: string;
  name: string;
  start_time: string; // "HH:MM:SS" format
  end_time: string;
  break_minutes: number;
  days_of_week: string[]; // ["monday", "tuesday", ...]
  color?: string;
};

export type AssignShiftData = {
  user_id: string;
  shift_id: string;
  organization_id: string;
  effective_from: Date;
  effective_until?: Date | null;
};

export async function createShift(data: CreateShiftData) {
  const inserted = await db
    .insert(shift)
    .values({
      organization_id: data.organization_id,
      name: data.name,
      start_time: data.start_time,
      end_time: data.end_time,
      break_minutes: data.break_minutes,
      days_of_week: data.days_of_week,
      color: data.color ?? null,
      active: true,
    })
    .returning();
  return inserted[0];
}

export async function getShiftsByOrganization(
  organizationId: string,
  pagination?: PaginationParams
) {
  const whereClause = and(eq(shift.organization_id, organizationId), eq(shift.active, true));

  const totalResult = await db
    .select({ value: count() })
    .from(shift)
    .where(whereClause);

  const baseQuery = db
    .select()
    .from(shift)
    .where(whereClause)
    .orderBy(desc(shift.created_at));

  const rows = await (pagination
    ? baseQuery.limit(pagination.limit).offset(pagination.offset)
    : baseQuery);

  return {
    shifts: rows,
    total: Number(totalResult[0]?.value ?? 0),
  };
}

export async function getShiftById(shiftId: string) {
  const rows = await db
    .select()
    .from(shift)
    .where(eq(shift.id, shiftId))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateShift(shiftId: string, data: Partial<CreateShiftData>) {
  const updated = await db
    .update(shift)
    .set({
      ...data,
      updated_at: new Date(),
    })
    .where(eq(shift.id, shiftId))
    .returning();
  return updated[0];
}

export async function assignShiftToUser(data: AssignShiftData) {
  const inserted = await db
    .insert(user_schedule)
    .values({
      user_id: data.user_id,
      shift_id: data.shift_id,
      organization_id: data.organization_id,
      effective_from: data.effective_from,
      effective_until: data.effective_until ?? null,
    })
    .returning();
  return inserted[0];
}

export async function getUserSchedule(userId: string, organizationId: string) {
  return await db
    .select()
    .from(user_schedule)
    .where(
      and(
        eq(user_schedule.user_id, userId),
        eq(user_schedule.organization_id, organizationId)
      )
    );
}

/**
 * Get the user's active shift for a specific date
 * A shift is active if:
 * - effective_from <= date
 * - effective_until is null OR effective_until >= date
 * - shift is active
 * - shift applies to the day of week
 */
export async function getUserActiveShift(userId: string, date: Date) {
  const schedules = await db
    .select({
      schedule: user_schedule,
      shift: shift,
    })
    .from(user_schedule)
    .innerJoin(shift, eq(user_schedule.shift_id, shift.id))
    .where(
      and(
        eq(user_schedule.user_id, userId),
        lte(user_schedule.effective_from, date),
        or(
          isNull(user_schedule.effective_until),
          gte(user_schedule.effective_until, date)
        ),
        eq(shift.active, true)
      )
    );

  if (schedules.length === 0) return null;

  // Check if shift applies to this day of week
  const dayOfWeek = getDayOfWeek(date);
  const activeShift = schedules.find(({ shift: s }) =>
    s.days_of_week.includes(dayOfWeek)
  );

  return activeShift ? activeShift.shift : null;
}

/**
 * Check if a shift is active on a specific day of week
 */
export function isShiftActiveOnDay(
  shift: { days_of_week: string[] },
  dayOfWeek: string
): boolean {
  return shift.days_of_week.includes(dayOfWeek.toLowerCase());
}

/**
 * Get day of week as lowercase string (monday, tuesday, etc.)
 */
export function getDayOfWeek(date: Date): string {
  const days = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  return days[date.getDay()] ?? "sunday";
}

/**
 * Parse time string "HH:MM:SS" and create Date for today at that time
 */
export function parseTimeToToday(timeString: string): Date {
  const [hours = 0, minutes = 0, seconds = 0] = timeString.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, seconds || 0, 0);
  return date;
}

/**
 * Get all users with active shifts for a specific organization and date
 */
export async function getUsersWithActiveShifts(
  organizationId: string,
  date: Date
) {
  const dayOfWeek = getDayOfWeek(date);

  const schedules = await db
    .select({
      schedule: user_schedule,
      shift: shift,
    })
    .from(user_schedule)
    .innerJoin(shift, eq(user_schedule.shift_id, shift.id))
    .where(
      and(
        eq(user_schedule.organization_id, organizationId),
        lte(user_schedule.effective_from, date),
        or(
          isNull(user_schedule.effective_until),
          gte(user_schedule.effective_until, date)
        ),
        eq(shift.active, true)
      )
    );

  // Filter by day of week
  return schedules.filter(({ shift: s }) =>
    s.days_of_week.includes(dayOfWeek)
  );
}
