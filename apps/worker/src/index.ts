import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { and, eq, gte, lte, or, isNull, not } from "drizzle-orm";

const workerEnvPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env");
const apiEnvPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../api/.env");
const placeholderDbUrl = "postgresql://user:password@localhost:5432/skyhr";

loadEnv({ path: workerEnvPath });
if (!process.env.DATABASE_URL || process.env.DATABASE_URL === placeholderDbUrl) {
  // Fall back to the API env when the worker env is still the placeholder.
  loadEnv({ path: apiEnvPath, override: true });
}

const { db, pool } = await import("../../api/src/db/index.ts");
const {
  attendance_event,
  organization,
  organization_settings,
  shift,
  user_schedule,
} = await import("../../api/src/db/schema.ts");

type OrgSettings = {
  organizationId: string;
  gracePeriodMinutes: number;
  timeZone: string;
};

type ShiftWindow = {
  start: Date;
  end: Date;
  checkWindowStart: Date;
  endWithBuffer: Date;
};

type DayBounds = {
  start: Date;
  end: Date;
};

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

function getTimeZoneOffset(date: Date, timeZone: string): number {
  const parts = getZonedParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  return asUtc - date.getTime();
}

function makeZonedDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string
): Date {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const offset = getTimeZoneOffset(utcGuess, timeZone);
  return new Date(utcGuess.getTime() - offset);
}

function addCalendarDays(
  year: number,
  month: number,
  day: number,
  delta: number
): { year: number; month: number; day: number } {
  const base = new Date(Date.UTC(year, month - 1, day));
  base.setUTCDate(base.getUTCDate() + delta);
  return {
    year: base.getUTCFullYear(),
    month: base.getUTCMonth() + 1,
    day: base.getUTCDate(),
  };
}

function getDayOfWeekInTimeZone(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" })
      .format(date)
      .toLowerCase();
  } catch {
    return new Intl.DateTimeFormat("en-US", { weekday: "long" })
      .format(date)
      .toLowerCase();
  }
}

function getDayOfWeekFromParts(
  parts: { year: number; month: number; day: number },
  timeZone: string
): string {
  const midday = makeZonedDate(parts.year, parts.month, parts.day, 12, 0, 0, timeZone);
  return getDayOfWeekInTimeZone(midday, timeZone);
}

function parseShiftTime(time: string) {
  const [hour = "0", minute = "0", second = "0"] = time.split(":");
  const hourNum = Number(hour);
  const minuteNum = Number(minute);
  const secondNum = Number(second);
  const totalMinutes = hourNum * 60 + minuteNum + secondNum / 60;
  return { hourNum, minuteNum, secondNum, totalMinutes };
}

function buildShiftWindow(
  baseParts: { year: number; month: number; day: number },
  timeZone: string,
  shiftStart: string,
  shiftEnd: string,
  graceMinutes: number,
  endBufferMinutes: number
): ShiftWindow {
  const startParts = parseShiftTime(shiftStart);
  const endParts = parseShiftTime(shiftEnd);

  const start = makeZonedDate(
    baseParts.year,
    baseParts.month,
    baseParts.day,
    startParts.hourNum,
    startParts.minuteNum,
    startParts.secondNum,
    timeZone
  );

  const endDayParts =
    endParts.totalMinutes <= startParts.totalMinutes
      ? addCalendarDays(baseParts.year, baseParts.month, baseParts.day, 1)
      : { year: baseParts.year, month: baseParts.month, day: baseParts.day };

  const end = makeZonedDate(
    endDayParts.year,
    endDayParts.month,
    endDayParts.day,
    endParts.hourNum,
    endParts.minuteNum,
    endParts.secondNum,
    timeZone
  );

  const checkWindowStart = new Date(start.getTime() - graceMinutes * 60000);
  const endWithBuffer = new Date(end.getTime() + endBufferMinutes * 60000);

  return { start, end, checkWindowStart, endWithBuffer };
}

function buildDayBounds(
  baseParts: { year: number; month: number; day: number },
  timeZone: string
): DayBounds {
  const start = makeZonedDate(
    baseParts.year,
    baseParts.month,
    baseParts.day,
    0,
    0,
    0,
    timeZone
  );
  const nextDay = addCalendarDays(baseParts.year, baseParts.month, baseParts.day, 1);
  const nextStart = makeZonedDate(
    nextDay.year,
    nextDay.month,
    nextDay.day,
    0,
    0,
    0,
    timeZone
  );
  const end = new Date(nextStart.getTime() - 1);
  return { start, end };
}

async function fetchOrganizations(): Promise<OrgSettings[]> {
  const rows = await db
    .select({
      organizationId: organization.id,
      gracePeriodMinutes: organization_settings.grace_period_minutes,
      timeZone: organization_settings.timezone,
    })
    .from(organization)
    .leftJoin(
      organization_settings,
      eq(organization_settings.organization_id, organization.id)
    )
    .where(eq(organization.is_active, true));

  return rows.map((row) => ({
    organizationId: row.organizationId,
    gracePeriodMinutes: row.gracePeriodMinutes ?? 5,
    timeZone: resolveTimeZone(row.timeZone),
  }));
}

async function markAbsencesForOrganization(org: OrgSettings) {
  const now = process.env.WORKER_NOW ? new Date(process.env.WORKER_NOW) : new Date();
  const endBufferMinutes = Number(process.env.ABSENCE_MARK_BUFFER_MINUTES ?? org.gracePeriodMinutes);
  const todayParts = getZonedParts(now, org.timeZone);
  const yesterdayParts = addCalendarDays(todayParts.year, todayParts.month, todayParts.day, -1);
  const candidateDates = [todayParts, yesterdayParts];

  const schedules = await db
    .select({
      schedule: user_schedule,
      shift: shift,
    })
    .from(user_schedule)
    .innerJoin(shift, eq(user_schedule.shift_id, shift.id))
    .where(
      and(
        eq(user_schedule.organization_id, org.organizationId),
        lte(user_schedule.effective_from, now),
        or(isNull(user_schedule.effective_until), gte(user_schedule.effective_until, now)),
        eq(shift.active, true)
      )
  );

  const todayName = getDayOfWeekFromParts(todayParts, org.timeZone);
  const yesterdayName = getDayOfWeekFromParts(yesterdayParts, org.timeZone);
  const activeSchedules = schedules.filter(({ shift: s }) =>
    s.days_of_week.includes(todayName) || s.days_of_week.includes(yesterdayName)
  );

  let marked = 0;
  for (const { schedule, shift: shiftRow } of activeSchedules) {
    for (const baseParts of candidateDates) {
      const candidateDay = getDayOfWeekFromParts(baseParts, org.timeZone);
      if (!shiftRow.days_of_week.includes(candidateDay)) {
        continue;
      }

      const candidateDate = makeZonedDate(
        baseParts.year,
        baseParts.month,
        baseParts.day,
        12,
        0,
        0,
        org.timeZone
      );
      if (schedule.effective_from > candidateDate) {
        continue;
      }
      if (schedule.effective_until && schedule.effective_until < candidateDate) {
        continue;
      }

      const window = buildShiftWindow(
        baseParts,
        org.timeZone,
        shiftRow.start_time,
        shiftRow.end_time,
        org.gracePeriodMinutes,
        endBufferMinutes
      );
      const endParts = getZonedParts(window.end, org.timeZone);
      const dayBounds = buildDayBounds(endParts, org.timeZone);

      const existingNonSystemForDay = await db
        .select({ id: attendance_event.id })
        .from(attendance_event)
        .where(
          and(
            eq(attendance_event.user_id, schedule.user_id),
            eq(attendance_event.organization_id, org.organizationId),
            gte(attendance_event.check_in, dayBounds.start),
            lte(attendance_event.check_in, dayBounds.end),
            not(
              and(
                eq(attendance_event.status, "absent"),
                eq(attendance_event.source, "system")
              )!
            )
          )
        )
        .limit(1);

      const debugEventsForDay = await db
        .select({
          id: attendance_event.id,
          checkIn: attendance_event.check_in,
          status: attendance_event.status,
          source: attendance_event.source,
        })
        .from(attendance_event)
        .where(
          and(
            eq(attendance_event.user_id, schedule.user_id),
            eq(attendance_event.organization_id, org.organizationId),
            gte(attendance_event.check_in, dayBounds.start),
            lte(attendance_event.check_in, dayBounds.end)
          )
        );

      console.log(
        `[worker] org=${org.organizationId} user=${schedule.user_id} dayStart=${dayBounds.start.toISOString()} dayEnd=${dayBounds.end.toISOString()} shiftStart=${window.start.toISOString()} shiftEnd=${window.end.toISOString()} bufferEnd=${window.endWithBuffer.toISOString()} events=${JSON.stringify(
          debugEventsForDay
        )}`
      );

      if (existingNonSystemForDay.length > 0) {
        await db
          .delete(attendance_event)
          .where(
            and(
              eq(attendance_event.user_id, schedule.user_id),
              eq(attendance_event.organization_id, org.organizationId),
              eq(attendance_event.status, "absent"),
              eq(attendance_event.source, "system"),
              gte(attendance_event.check_in, dayBounds.start),
              lte(attendance_event.check_in, dayBounds.end)
            )
          );
        continue;
      }

      if (now < window.endWithBuffer) {
        continue;
      }

      const existing = await db
        .select({ id: attendance_event.id })
        .from(attendance_event)
        .where(
          and(
            eq(attendance_event.user_id, schedule.user_id),
            eq(attendance_event.organization_id, org.organizationId),
            gte(attendance_event.check_in, window.checkWindowStart),
            lte(attendance_event.check_in, window.end)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        continue;
      }

      await db
        .insert(attendance_event)
        .values({
          user_id: schedule.user_id,
          organization_id: org.organizationId,
          shift_id: shiftRow.id,
          check_in: window.end,
          check_out: window.end,
          status: "absent",
          is_within_geofence: false,
          is_verified: false,
          source: "system",
          notes: `Auto-marked absent after shift end (${shiftRow.end_time}) in ${org.timeZone}.`,
        })
        .returning();

      marked += 1;
      break;
    }
  }

  return { marked, total: activeSchedules.length };
}

async function runOnce() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  const organizations = await fetchOrganizations();
  if (organizations.length === 0) {
    console.log("[worker] No active organizations found.");
    return;
  }

  console.log(`[worker] Running absence sweep for ${organizations.length} organization(s).`);

  let totalMarked = 0;
  for (const org of organizations) {
    const { marked, total } = await markAbsencesForOrganization(org);
    totalMarked += marked;
    console.log(
      `[worker] org=${org.organizationId} timezone=${org.timeZone} schedules=${total} marked=${marked}`
    );
  }

  console.log(`[worker] Sweep completed. Total marked: ${totalMarked}.`);
}

try {
  await runOnce();
} finally {
  await pool.end();
}
