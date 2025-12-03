import { db } from "../../db";
import {
  attendance_event,
  user_schedule,
  users,
  shift,
  user_payroll,
  geofence,
  member,
  organization_settings,
} from "../../db/schema";
import { and, eq, gte, lte, sql, count, sum, desc, inArray, or } from "drizzle-orm";
import type { 
  AttendanceMetrics, 
  CostMetrics, 
  DateRange, 
  LocationRanking, 
  LocationHeatmapPoint, 
  TrendsData,
  TrendPoint,
  UserAttendanceStats,
  UserAttendanceRecord,
  Period
} from "./types";

// --- Data Aggregation Functions ---

export async function getAttendanceDataForPeriod(organizationId: string, range: DateRange, locationId?: string) {
  const conditions = [
    eq(attendance_event.organization_id, organizationId),
    gte(attendance_event.check_in, range.startDate),
    lte(attendance_event.check_in, range.endDate)
  ];

  if (locationId) {
    conditions.push(eq(attendance_event.location_id, locationId));
  }

  return await db
    .select()
    .from(attendance_event)
    .where(and(...conditions));
}

export async function getScheduledDaysForPeriod(organizationId: string, range: DateRange) {
  // This is a simplified calculation. In a real system, we'd need to expand the recurring schedules
  // into actual calendar days. For now, we'll estimate based on active schedules.
  
  // Get all active schedules in the period
  const schedules = await db
    .select({
      userId: user_schedule.user_id,
      daysOfWeek: shift.days_of_week,
      startTime: shift.start_time,
      endTime: shift.end_time,
    })
    .from(user_schedule)
    .innerJoin(shift, eq(user_schedule.shift_id, shift.id))
    .where(
      and(
        eq(user_schedule.organization_id, organizationId),
        // Schedule started before end of period
        lte(user_schedule.effective_from, range.endDate),
        // Schedule ends after start of period (or is indefinite)
        sql`(${user_schedule.effective_until} IS NULL OR ${user_schedule.effective_until} >= ${range.startDate})`
      )
    );

  // Calculate total scheduled shifts (simplified)
  let totalScheduledShifts = 0;
  const daysInPeriod = Math.ceil((range.endDate.getTime() - range.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  // Rough estimate: average shifts per week * weeks in period * number of users
  // A better implementation would iterate through each day of the period
  
  // For this MVP, let's count actual days in the period that match schedule days
  for (let d = new Date(range.startDate); d <= range.endDate; d.setDate(d.getDate() + 1)) {
    const dayName = d.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    
    for (const sched of schedules) {
      if (sched.daysOfWeek.includes(dayName)) {
        totalScheduledShifts++;
      }
    }
  }

  return totalScheduledShifts;
}

export async function getEmployeeCountStats(organizationId: string, range: DateRange) {
  // Active employees at end of period
  const activeResult = await db
    .select({ count: count() })
    .from(member)
    .where(eq(member.organizationId, organizationId));
    
  const totalEmployees = Number(activeResult[0]?.count ?? 0);
  
  // For rotation, we'd need a 'departed_at' or similar in member table, 
  // or track status changes. Using users.deleted_at as proxy if available/relevant
  // but member table doesn't have status history. 
  // For now, returning 0 for departures as we don't track them explicitly in schema provided.
  
  return {
    totalEmployees: totalEmployees || 1, // Avoid division by zero
    departures: 0
  };
}

// --- User Specific Functions ---

export async function getUserByIdOrEmail(identifier: string, organizationId: string) {
  // Find user member record by ID or Email
  // We need to join with users table to check email if identifier is an email
  
  const isEmail = identifier.includes('@');
  
  const userRecords = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email
    })
    .from(users)
    .innerJoin(member, eq(users.id, member.userId))
    .where(
      and(
        eq(member.organizationId, organizationId),
        isEmail ? eq(users.email, identifier) : eq(users.id, identifier)
      )
    )
    .limit(1);
    
  return userRecords[0] || null;
}

export async function getUserScheduledDays(userId: string, organizationId: string, range: DateRange) {
  const schedules = await db
    .select({
      daysOfWeek: shift.days_of_week,
      startTime: shift.start_time,
      endTime: shift.end_time,
    })
    .from(user_schedule)
    .innerJoin(shift, eq(user_schedule.shift_id, shift.id))
    .where(
      and(
        eq(user_schedule.user_id, userId),
        eq(user_schedule.organization_id, organizationId),
        lte(user_schedule.effective_from, range.endDate),
        sql`(${user_schedule.effective_until} IS NULL OR ${user_schedule.effective_until} >= ${range.startDate})`
      )
    );

  let scheduledDays = 0;
  let scheduledHours = 0;
  
  // Iterate through each day in range
  const currentDate = new Date(range.startDate);
  const end = new Date(range.endDate);
  
  while (currentDate <= end) {
    const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    
    for (const sched of schedules) {
      if (sched.daysOfWeek.includes(dayName)) {
        scheduledDays++;
        
        // Calculate hours (simplified HH:MM:SS format)
        try {
          const [startH = 0, startM = 0] = sched.startTime.split(':').map(Number);
          const [endH = 0, endM = 0] = sched.endTime.split(':').map(Number);
          const hours = (endH + endM/60) - (startH + startM/60);
          scheduledHours += Math.max(0, hours);
        } catch (e) {
          scheduledHours += 8; // Default fallback
        }
        break; // Assume 1 shift per day max for calculation
      }
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return { scheduledDays, scheduledHours };
}

export async function calculateUserAttendanceStats(
  userId: string, 
  organizationId: string, 
  range: DateRange,
  period: Period
): Promise<UserAttendanceStats | null> {
  // 1. Verify user
  const user = await getUserByIdOrEmail(userId, organizationId);
  if (!user) return null;
  
  // 2. Get attendance events
  const events = await db
    .select({
      event: attendance_event,
      locationName: geofence.name
    })
    .from(attendance_event)
    .leftJoin(geofence, eq(attendance_event.location_id, geofence.id))
    .where(
      and(
        eq(attendance_event.user_id, user.userId),
        eq(attendance_event.organization_id, organizationId),
        gte(attendance_event.check_in, range.startDate),
        lte(attendance_event.check_in, range.endDate)
      )
    )
    .orderBy(desc(attendance_event.check_in));
    
  // 3. Get schedule info
  const scheduleInfo = await getUserScheduledDays(user.userId, organizationId, range);
  
  // 4. Calculate metrics
  // totalCheckIns includes ALL check-ins: both 'on_time' and 'late' status
  // Late arrivals count as present (worked), not as absences
  const totalCheckIns = events.length;
  const onTimeCheckIns = events
    .filter(e => e.event.status === 'on_time' || e.event.status === 'early')
    .filter(Boolean).length;
  const lateArrivals = events.filter(e => e.event.status === 'late').length;
  
  let totalWorkHours = 0;
  
  events.forEach(({ event }) => {
    if (event.check_in && event.check_out) {
      const ms = event.check_out.getTime() - event.check_in.getTime();
      totalWorkHours += ms / (1000 * 60 * 60);
    }
  });
  
  const overtimeHours = Math.max(0, totalWorkHours - scheduleInfo.scheduledHours);
  const attendanceRate = scheduleInfo.scheduledDays > 0 
    ? (totalCheckIns / scheduleInfo.scheduledDays) * 100 
    : 0;
    
  const punctualityRate = totalCheckIns > 0 
    ? (onTimeCheckIns / totalCheckIns) * 100 
    : 0;

  // 5. Calculate Cost Impact
  const payroll = await db
    .select()
    .from(user_payroll)
    .where(eq(user_payroll.user_id, user.userId))
    .limit(1);
    
  let costImpact;
  if (payroll.length > 0 && payroll[0]) {
    const rate = payroll[0].hourly_rate;
    const regularHours = Math.min(totalWorkHours, scheduleInfo.scheduledHours);
    const regularPay = regularHours * rate;
    const overtimePay = overtimeHours * rate * 1.5; // 1.5x overtime multiplier
    
    costImpact = {
      regularPay: regularPay || 0,
      overtimePay: overtimePay || 0,
      totalPay: (regularPay + overtimePay) || 0,
      currency: 'MXN'
    };
  }
  
  // 6. Format Recent Activity
  const recentActivity: UserAttendanceRecord[] = events.slice(0, 10).map(({ event, locationName }) => {
    let hoursWorked = null;
    if (event.check_in && event.check_out) {
      hoursWorked = (event.check_out.getTime() - event.check_in.getTime()) / (1000 * 60 * 60);
    }
    
    return {
      id: event.id,
      checkIn: event.check_in,
      checkOut: event.check_out,
      status: event.status,
      locationName: locationName || 'Unknown Location',
      hoursWorked,
      isLate: event.status === 'late'
    };
  });

  return {
    userId: user.userId,
    userName: user.name,
    userEmail: user.email,
    period,
    dateRange: range,
    metrics: {
      attendanceRate,
      punctualityRate,
      totalWorkHours,
      overtimeHours,
      lateArrivals,
      // Absences = scheduled days with NO check-in (late arrivals are NOT absences)
      absences: Math.max(0, scheduleInfo.scheduledDays - totalCheckIns),
      onTimeCheckIns,
      totalCheckIns
    },
    costImpact,
    recentActivity
  };
}

// --- Core Attendance Metrics ---

export async function calculateAttendanceMetrics(
  organizationId: string, 
  range: DateRange,
  locationId?: string
): Promise<AttendanceMetrics> {
  const events = await getAttendanceDataForPeriod(organizationId, range, locationId);
  const totalScheduled = await getScheduledDaysForPeriod(organizationId, range); // Note: location filter not easily applied to schedule without more joins
  const empStats = await getEmployeeCountStats(organizationId, range);
  
  // Treat explicit "absent" events as absences, not worked days
  const absenceEvents = events.filter(e => e.status === 'absent').length;
  const workedEvents = events.filter(e => e.status !== 'absent');
  
  // daysWorked counts check-ins that are not absences (late counts as worked)
  const daysWorked = workedEvents.length;
  
  // Punctuality metrics (separate from attendance)
  const onTimeEntries = workedEvents.filter(e => e.status === 'on_time' || e.status === 'early').length;
  const lateEntries = workedEvents.filter(e => e.status === 'late').length;
  
  // Absenteeism (Unjustified)
  // If we have schedule data, use it. Otherwise, fall back to explicit absent events to avoid inflating the denominator.
  const eventDenominator = daysWorked + absenceEvents;
  const hasScheduleData = totalScheduled > 0;
  // Prefer schedule only if it does not massively exceed recorded events, otherwise fall back to events.
  const useSchedule = hasScheduleData && (eventDenominator === 0 || totalScheduled <= eventDenominator);
  
  const unjustifiedAbsences = useSchedule
    ? Math.max(0, totalScheduled - daysWorked)
    : absenceEvents;
  const attendanceDenominator = useSchedule
    ? totalScheduled
    : eventDenominator;

  return {
    attendanceRate: attendanceDenominator > 0 ? (daysWorked / attendanceDenominator) * 100 : 0,
    punctualityIndex: daysWorked > 0 ? (onTimeEntries / daysWorked) * 100 : 0,
    unjustifiedAbsenteeism: attendanceDenominator > 0 ? (unjustifiedAbsences / attendanceDenominator) * 100 : 0,
    operationalRotation: 0, // No departure data
    averageDelays: empStats.totalEmployees > 0 ? lateEntries / empStats.totalEmployees : 0,
    coverageRate: attendanceDenominator > 0 ? (daysWorked / attendanceDenominator) * 100 : 0, // Align coverage with attendance denominator
    reportCompliance: 100 // Placeholder, assumes all attendance is reported automatically
  };
}

// --- Cost Metrics ---

export async function calculateCostMetrics(
  organizationId: string,
  range: DateRange
): Promise<CostMetrics> {
  const events = await getAttendanceDataForPeriod(organizationId, range);
  const absenceEvents = events.filter(e => e.status === 'absent');
  const workedEvents = events.filter(e => e.status !== 'absent');
  
  // Get payroll data for users involved
  const userIds = [...new Set(events.map(e => e.user_id).filter(Boolean) as string[])];
  
  if (userIds.length === 0) {
  return {
    absenteeismCost: 0,
    overtimeCost: 0,
    totalCostImpact: 0,
    currency: 'MXN'
  };
  }
  const payrolls = await db
    .select()
    .from(user_payroll)
    .where(inArray(user_payroll.user_id, userIds));

  const [settings] = await db
    .select({ extraHourCost: organization_settings.extra_hour_cost })
    .from(organization_settings)
    .where(eq(organization_settings.organization_id, organizationId))
    .limit(1);
  const extraHourCost = settings?.extraHourCost ?? 0;

  const payrollMap = new Map(payrolls.map(p => [p.user_id, p]));
  
  let overtimeCost = 0;
  let absenteeismCost = 0;
  
  // Calculate Overtime Cost (simplified: assume > 8 hours is overtime)
  // In real app, use shift duration
  for (const event of workedEvents) {
    if (event.check_in && event.check_out && event.user_id) {
      const durationHours = (event.check_out.getTime() - event.check_in.getTime()) / (1000 * 60 * 60);
      const payroll = payrollMap.get(event.user_id);
      
      if (payroll && payroll.overtime_allowed && durationHours > 8) {
        const overtimeHours = durationHours - 8;
        const overtimeRate = extraHourCost > 0 ? extraHourCost : payroll.hourly_rate * 1.5;
        overtimeCost += overtimeHours * overtimeRate;
      }
    }
  }
  
  // Calculate Absenteeism Cost
  // Estimate: Unworked scheduled hours * average hourly rate
  const totalScheduled = await getScheduledDaysForPeriod(organizationId, range);
  const daysWorked = workedEvents.length;
  const eventDenominator = daysWorked + absenceEvents.length;
  const useSchedule = totalScheduled > 0 && (eventDenominator === 0 || totalScheduled <= eventDenominator);
  // Prefer schedule only when it doesn't inflate beyond recorded events
  const missedDays = useSchedule
    ? Math.max(0, totalScheduled - daysWorked)
    : absenceEvents.length;
  
  // Calculate average hourly rate
  const rates = payrolls.map(p => p.hourly_rate);
  const avgRate = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
  
  // Assume 8 hour days for missed days
  absenteeismCost = missedDays * 8 * avgRate;
  
  return {
    absenteeismCost,
    overtimeCost,
    totalCostImpact: absenteeismCost + overtimeCost,
    currency: 'MXN' // Default currency
  };
}

// --- Comparative Analytics ---

export async function getGeofenceStats(organizationId: string, range: DateRange) {
  // Get all geofences
  const geofences = await db
    .select()
    .from(geofence)
    .where(eq(geofence.organization_id, organizationId));
    
  const results: LocationRanking[] = [];
  const heatmapPoints: LocationHeatmapPoint[] = [];
  
  for (const gf of geofences) {
    const metrics = await calculateAttendanceMetrics(organizationId, range, gf.id);
    
    results.push({
      locationId: gf.id,
      locationName: gf.name,
      attendanceRate: metrics.attendanceRate,
      absenteeismRate: metrics.unjustifiedAbsenteeism,
      punctualityIndex: metrics.punctualityIndex,
      rank: 0 // to be assigned
    });
    
    // Heatmap data - count incidents (late, absent, etc.)
    const events = await getAttendanceDataForPeriod(organizationId, range, gf.id);
    const incidents = events.filter(e => e.status !== 'on_time').length;
    
  if (gf.center_latitude && gf.center_longitude) {
      const lat = parseFloat(gf.center_latitude);
      const lon = parseFloat(gf.center_longitude);
      
      if (!isNaN(lat) && !isNaN(lon)) {
           heatmapPoints.push({
              locationId: gf.id,
              locationName: gf.name,
              latitude: lat,
              longitude: lon,
              incidentCount: incidents,
              severity: incidents > 10 ? 'high' : incidents > 5 ? 'medium' : 'low'
            });
      }
  }
  }
  
  // Rank by attendance rate (descending)
  results.sort((a, b) => b.attendanceRate - a.attendanceRate);
  results.forEach((r, i) => r.rank = i + 1);
  
  return { rankings: results, heatmap: heatmapPoints };
}

export async function getTrends(organizationId: string): Promise<TrendsData> {
  // Last 3 months
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 3);
  
  // Buckets by month
  const months: string[] = [];
  const current = new Date(start);
  while (current <= end) {
    months.push(current.toISOString().slice(0, 7)); // YYYY-MM
    current.setMonth(current.getMonth() + 1);
  }
  
  const attendanceTrend: TrendPoint[] = [];
  const punctualityTrend: TrendPoint[] = [];
  const absenteeismTrend: TrendPoint[] = [];
  
  for (const monthStr of months) {
    const [year, month] = monthStr.split('-').map(Number) as [number, number];
    const monthStart = new Date(year, month - 1, 1);
    let monthEnd = new Date(year, month, 0, 23, 59, 59); // Last day of month

    // If monthEnd is in the future, cap it to now to get month-to-date stats
    // This prevents the attendance rate from plummeting at the start of the month
    // because the denominator (scheduled days) would otherwise include the whole month
    const now = new Date();
    if (monthEnd > now) {
      monthEnd = now;
    }
    
    const metrics = await calculateAttendanceMetrics(organizationId, { startDate: monthStart, endDate: monthEnd });
    
    attendanceTrend.push({ date: monthStr, value: metrics.attendanceRate });
    punctualityTrend.push({ date: monthStr, value: metrics.punctualityIndex });
    absenteeismTrend.push({ date: monthStr, value: metrics.unjustifiedAbsenteeism });
  }
  
  return {
    attendance: attendanceTrend,
    punctuality: punctualityTrend,
    absenteeism: absenteeismTrend
  };
}
