import "dotenv/config";
import { db } from "../src/db/index";
import {
  attendance_event,
  shift,
  user_schedule,
  geofence,
  user_geofence,
  user_payroll,
  member,
  organization,
} from "../src/db/schema";
import { eq, inArray } from "drizzle-orm";
import {
  calculateAttendanceMetrics,
  calculateCostMetrics,
  getGeofenceStats,
} from "../src/modules/statistics/statistics.service";
import { subDays, startOfDay, addMinutes, format, set } from "date-fns";

const TARGET_ORG_ID = "q70149aXHHWy3b3TNKhkxAYW64yvB6G7";

async function run() {
  console.log(
    `\n🧹 Starting reset + reseed for organization: ${TARGET_ORG_ID}`,
  );

  // 1. Verify org exists
  const orgs = await db
    .select()
    .from(organization)
    .where(eq(organization.id, TARGET_ORG_ID))
    .limit(1);
  const org = orgs[0];
  if (!org) {
    console.error(`Organization ${TARGET_ORG_ID} not found.`);
    process.exit(1);
  }

  // 2. Find real users in this org
  const orgMembers = await db
    .select()
    .from(member)
    .where(eq(member.organizationId, TARGET_ORG_ID));
  if (orgMembers.length < 2) {
    console.error(
      `Expected at least 2 members in org ${TARGET_ORG_ID}, found ${orgMembers.length}.`,
    );
    process.exit(1);
  }
  const userIds = orgMembers.map((m: any) => m.userId);
  console.log(`👥 Found ${userIds.length} members.`);

  // 3. Delete existing data for the org
  console.log(`🗑️ Deleting existing attendance events...`);
  await db
    .delete(attendance_event)
    .where(eq(attendance_event.organization_id, TARGET_ORG_ID));

  console.log(`🗑️ Deleting existing schedules...`);
  await db
    .delete(user_schedule)
    .where(eq(user_schedule.organization_id, TARGET_ORG_ID));

  console.log(`🗑️ Deleting existing shifts...`);
  await db.delete(shift).where(eq(shift.organization_id, TARGET_ORG_ID));

  console.log(`🗑️ Deleting existing user geofences...`);
  await db
    .delete(user_geofence)
    .where(eq(user_geofence.organization_id, TARGET_ORG_ID));

  console.log(`🗑️ Deleting existing geofences...`);
  await db.delete(geofence).where(eq(geofence.organization_id, TARGET_ORG_ID));

  console.log(`🗑️ Deleting existing payroll data for org members...`);
  await db.delete(user_payroll).where(inArray(user_payroll.user_id, userIds));

  // 4. Create Geofences
  console.log(`🏗️ Creating geofences...`);
  const [hq, remote] = await db
    .insert(geofence)
    .values([
      {
        name: "Headquarters",
        type: "circular",
        center_latitude: "40.7128", // NY
        center_longitude: "-74.0060",
        radius: 100,
        organization_id: TARGET_ORG_ID,
      },
      {
        name: "Remote Office",
        type: "circular",
        center_latitude: "34.0522", // LA
        center_longitude: "-118.2437",
        radius: 100,
        organization_id: TARGET_ORG_ID,
      },
    ])
    .returning();

  // 5. Assign Geofences to users
  console.log(`🏗️ Assigning geofences to users...`);
  const user1 = userIds[0]!;
  const user2 = userIds[1]!;
  await db.insert(user_geofence).values([
    { user_id: user1, geofence_id: hq!.id, organization_id: TARGET_ORG_ID },
    { user_id: user2, geofence_id: remote!.id, organization_id: TARGET_ORG_ID },
  ]);

  // 6. Create Shifts
  console.log(`🏗️ Creating shifts...`);
  const [morningShift, eveningShift] = await db
    .insert(shift)
    .values([
      {
        organization_id: TARGET_ORG_ID,
        name: "Morning Shift",
        start_time: "09:00:00",
        end_time: "17:00:00",
        break_minutes: 60,
        days_of_week: ["monday", "tuesday", "wednesday", "thursday", "friday"],
        color: "#3498db",
      },
      {
        organization_id: TARGET_ORG_ID,
        name: "Evening Shift",
        start_time: "15:00:00",
        end_time: "23:00:00",
        break_minutes: 60,
        days_of_week: ["monday", "tuesday", "wednesday", "thursday", "friday"],
        color: "#9b59b6",
      },
    ])
    .returning();

  // 7. Create user_schedule
  console.log(`🏗️ Assigning schedules...`);
  await db.insert(user_schedule).values([
    {
      user_id: user1,
      shift_id: morningShift!.id,
      organization_id: TARGET_ORG_ID,
      effective_from: subDays(new Date(), 100), // Effective from 100 days ago
    },
    {
      user_id: user2,
      shift_id: eveningShift!.id,
      organization_id: TARGET_ORG_ID,
      effective_from: subDays(new Date(), 100),
    },
  ]);

  // 8. Create user_payroll
  console.log(`🏗️ Creating payroll configurations...`);
  await db.insert(user_payroll).values([
    {
      user_id: user1,
      hourly_rate: 25.0,
      overtime_allowed: true,
    },
    {
      user_id: user2,
      hourly_rate: 30.0,
      overtime_allowed: false,
    },
  ]);

  // 9. Generate Deterministic Attendance
  console.log(
    `🏗️ Generating deterministic attendance events (last 90 days)...`,
  );
  const events = [];
  const today = startOfDay(new Date());

  for (let i = 0; i < 90; i++) {
    const currentDate = subDays(today, i);
    const dayOfWeek = format(currentDate, "EEEE").toLowerCase();

    // Only process weekdays (both shifts are M-F)
    if (dayOfWeek === "saturday" || dayOfWeek === "sunday") continue;

    // Pattern for User 1 (Morning Shift M-F at HQ)
    // 70% on time, 10% late, 10% early, 10% absent
    const r1 = (i * 13) % 100;
    if (r1 < 10) {
      // Absent - do nothing (or record if system supports explicit absent events)
      events.push({
        user_id: user1,
        check_in: set(currentDate, { hours: 9, minutes: 0 }),
        check_out: null,
        is_verified: true,
        organization_id: TARGET_ORG_ID,
        location_id: hq!.id,
        shift_id: morningShift!.id,
        status: "absent",
        is_within_geofence: true,
        source: "system",
      });
    } else {
      let checkInOffset = 0; // minutes
      let checkOutOffset = 0;
      let status = "on_time";

      if (r1 < 20) {
        // Late
        checkInOffset = 30; // 30 mins late
        checkOutOffset = 30;
        status = "late";
      } else if (r1 < 30) {
        // Early
        checkInOffset = -15; // 15 mins early
        checkOutOffset = -15;
        status = "early";
      }

      // Add overtime for User 1 (~14% of the time, 1-2 hours)
      if (i % 7 === 0) {
        checkOutOffset += i % 2 === 0 ? 60 : 120; // 1 or 2 extra hours
      }

      events.push({
        user_id: user1,
        check_in: addMinutes(
          set(currentDate, { hours: 9, minutes: 0 }),
          checkInOffset,
        ),
        check_out: addMinutes(
          set(currentDate, { hours: 17, minutes: 0 }),
          checkOutOffset,
        ),
        is_verified: true,
        organization_id: TARGET_ORG_ID,
        location_id: hq!.id,
        shift_id: morningShift!.id,
        status,
        is_within_geofence: true,
        latitude: hq!.center_latitude,
        longitude: hq!.center_longitude,
        source: "face",
      });
    }

    // Pattern for User 2 (Evening Shift M-F at Remote)
    // 80% on time, 10% out_of_bounds, 10% late
    const r2 = (i * 17) % 100;

    // Add overtime for User 2 (~12% of the time, 1.5 hours) - should not affect cost since overtime_allowed = false
    let checkOutTime2 = set(currentDate, { hours: 23, minutes: 0 });
    if (i % 8 === 0) {
      checkOutTime2 = addMinutes(checkOutTime2, 90);
    }

    if (r2 < 10) {
      // Late
      events.push({
        user_id: user2,
        check_in: set(currentDate, { hours: 15, minutes: 45 }), // 45 mins late
        check_out: checkOutTime2,
        is_verified: true,
        organization_id: TARGET_ORG_ID,
        location_id: remote!.id,
        shift_id: eveningShift!.id,
        status: "late",
        is_within_geofence: true,
        latitude: remote!.center_latitude,
        longitude: remote!.center_longitude,
        source: "fingerprint",
      });
    } else if (r2 < 20) {
      // Out of bounds
      events.push({
        user_id: user2,
        check_in: set(currentDate, { hours: 15, minutes: 0 }),
        check_out: checkOutTime2,
        is_verified: true,
        organization_id: TARGET_ORG_ID,
        location_id: remote!.id,
        shift_id: eveningShift!.id,
        status: "out_of_bounds",
        is_within_geofence: false,
        latitude: "35.0", // some random coord
        longitude: "-119.0",
        source: "face",
      });
    } else {
      // On time
      events.push({
        user_id: user2,
        check_in: set(currentDate, { hours: 15, minutes: 0 }),
        check_out: checkOutTime2,
        is_verified: true,
        organization_id: TARGET_ORG_ID,
        location_id: remote!.id,
        shift_id: eveningShift!.id,
        status: "on_time",
        is_within_geofence: true,
        latitude: remote!.center_latitude,
        longitude: remote!.center_longitude,
        source: "face",
      });
    }
  }

  // Insert in chunks
  console.log(`Inserting ${events.length} attendance events...`);
  const chunkSize = 50;
  for (let i = 0; i < events.length; i += chunkSize) {
    const chunk = events.slice(i, i + chunkSize);
    await db.insert(attendance_event).values(chunk);
  }

  console.log(`✅ Seeding complete!`);

  // 10. Compute and Print Post-Seed Outputs
  console.log(`\n📊 Generating Statistics Output Snapshot...`);

  const from = subDays(today, 30); // Last 30 days
  const to = today;

  try {
    const overview = await calculateAttendanceMetrics(TARGET_ORG_ID, {
      startDate: from,
      endDate: to,
    });
    const costs = await calculateCostMetrics(TARGET_ORG_ID, {
      startDate: from,
      endDate: to,
    });
    const locations = await getGeofenceStats(TARGET_ORG_ID, {
      startDate: from,
      endDate: to,
    });

    console.log(`\n=== OVERVIEW (Last 30 Days) ===`);
    console.log(`Attendance Rate: ${overview.attendanceRate.toFixed(2)}%`);
    console.log(`Punctuality Index: ${overview.punctualityIndex.toFixed(2)}%`);
    console.log(
      `Unjustified Absenteeism: ${overview.unjustifiedAbsenteeism.toFixed(2)}%`,
    );
    console.log(`Average Delays: ${overview.averageDelays.toFixed(2)}`);

    console.log(`\n=== COSTS (Last 30 Days) ===`);
    console.log(`Total Cost Impact: $${costs.totalCostImpact.toFixed(2)}`);
    console.log(`Absenteeism Cost: $${costs.absenteeismCost.toFixed(2)}`);
    console.log(`Overtime Cost: $${costs.overtimeCost.toFixed(2)}`);

    console.log(`\n=== LOCATIONS (Last 30 Days) ===`);
    locations.rankings.forEach((l: any) => {
      console.log(
        `${l.locationName}: Rank ${l.rank} - Attendance: ${l.attendanceRate}%, Punctuality: ${l.punctualityIndex}%`,
      );
    });
  } catch (e) {
    console.error("Failed to generate statistics snapshot:", e);
  }

  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
