import "dotenv/config";
import { db } from "../src/db/index";
import { attendance_event, users, member, organization } from "../src/db/schema";
import { eq } from "drizzle-orm";

const orgId = process.argv[2] || "2uJGuHdtRgVZrPXGZr8kg4yxagDiNhUD";
const eventCount = parseInt(process.argv[3] || "100");
const daysBack = parseInt(process.argv[4] || "30"); // How many days back to generate events

interface EventConfig {
  status: "on_time" | "late" | "absent" | "out_of_bounds";
  weight: number;
}

// 50% on time, 50% other statuses
const statusDistribution: EventConfig[] = [
  { status: "on_time", weight: 0.5 },
  { status: "late", weight: 0.25 },
  { status: "absent", weight: 0.15 },
  { status: "out_of_bounds", weight: 0.1 },
];

const randomStatus = (): "on_time" | "late" | "absent" | "out_of_bounds" => {
  const rand = Math.random();
  let cumulativeWeight = 0;
  
  for (const config of statusDistribution) {
    cumulativeWeight += config.weight;
    if (rand <= cumulativeWeight) {
      return config.status;
    }
  }
  
  return "on_time";
};

const randomDateInPast = (daysBack: number): Date => {
  const now = new Date();
  const daysAgo = Math.floor(Math.random() * daysBack);
  const date = new Date(now);
  date.setDate(date.getDate() - daysAgo);
  
  // Set to a random hour between 8 AM and 6 PM
  const hour = 8 + Math.floor(Math.random() * 10);
  const minute = Math.floor(Math.random() * 60);
  date.setHours(hour, minute, 0, 0);
  
  return date;
};

const getEventConfig = (status: "on_time" | "late" | "absent" | "out_of_bounds") => {
  const baseLatitude = 40.7128;
  const baseLongitude = -74.0060;
  const randomOffset = () => (Math.random() - 0.5) * 0.01;
  
  let isWithinGeofence = true;
  let isVerified = true;
  let source = "mobile_app";
  let notes = "";
  let distanceToGeofence = Math.floor(Math.random() * 50);
  
  switch (status) {
    case "late":
      notes = `Checked in ${10 + Math.floor(Math.random() * 30)} minutes late.`;
      break;
    case "absent":
      isVerified = false;
      source = "system";
      notes = "Auto-marked absent. No check-in recorded.";
      break;
    case "out_of_bounds":
      isWithinGeofence = false;
      distanceToGeofence = 150 + Math.floor(Math.random() * 200);
      notes = `Check-in ${distanceToGeofence}m from geofence. Out of allowed area.`;
      break;
    case "on_time":
    default:
      notes = "On-time check-in.";
      break;
  }
  
  return {
    isWithinGeofence,
    isVerified,
    source,
    notes,
    distanceToGeofence,
    latitude: String(baseLatitude + randomOffset()),
    longitude: String(baseLongitude + randomOffset()),
    faceConfidence: String(85 + Math.random() * 15),
    livenessScore: String(90 + Math.random() * 10),
    spoofFlag: false,
  };
};

async function generateBulkAttendance() {
  try {
    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("   Bulk Attendance Event Generator");
    console.log("═══════════════════════════════════════════════════════════");
    console.log(`🏢 Organization ID: ${orgId}`);
    console.log(`📊 Events to generate: ${eventCount}`);
    console.log(`📅 Date range: Last ${daysBack} days`);
    console.log(`⚖️  Distribution: 50% on_time, 25% late, 15% absent, 10% out_of_bounds`);
    console.log("\n");
    
    // Check if organization exists
    const orgRows = await db
      .select()
      .from(organization)
      .where(eq(organization.id, orgId))
      .limit(1);
    
    if (orgRows.length === 0) {
      console.log(`⚠️  Organization ${orgId} not found. Creating it...`);
      
      const newOrg = await db
        .insert(organization)
        .values({
          id: orgId,
          name: "Test Organization",
          slug: `test-org-${Date.now()}`,
          createdAt: new Date(),
          is_active: true,
        })
        .returning();
      
      if (newOrg && newOrg[0]) {
        console.log(`✅ Organization created: ${newOrg[0].name}\n`);
      }
    } else {
      console.log(`✅ Organization found: ${orgRows[0].name}\n`);
    }
    
    // Get all members of this organization
    const memberRows = await db
      .select()
      .from(member)
      .where(eq(member.organizationId, orgId));
    
    if (memberRows.length === 0) {
      console.log(`⚠️  No members found in organization. Creating test users...`);
      
      // Create some test users
      const testUserCount = Math.min(5, Math.ceil(eventCount / 10));
      const createdUsers = [];
      
      for (let i = 0; i < testUserCount; i++) {
        const userId = `test-user-${Date.now()}-${i}`;
        const newUser = await db
          .insert(users)
          .values({
            id: userId,
            name: `Test User ${i + 1}`,
            email: `test.user.${i + 1}.${Date.now()}@skyhr.com`,
            emailVerified: true,
          })
          .returning();
        
        if (newUser && newUser[0]) {
          console.log(`✅ Created user: ${newUser[0].name}`);
          
          // Add user to organization
          await db.insert(member).values({
            id: `member-${Date.now()}-${i}`,
            userId: userId,
            organizationId: orgId,
            role: "member",
            createdAt: new Date(),
          });
          
          createdUsers.push(userId);
        }
      }
      
      console.log(`\n✅ Created ${createdUsers.length} test users and added them to organization\n`);
      
      // Re-fetch members
      const updatedMembers = await db
        .select()
        .from(member)
        .where(eq(member.organizationId, orgId));
      
      memberRows.push(...updatedMembers);
    } else {
      console.log(`✅ Found ${memberRows.length} members in organization\n`);
    }
    
    const userIds = memberRows.map(m => m.userId);
    
    // Generate events
    console.log(`📝 Generating ${eventCount} attendance events...\n`);
    
    const events = [];
    const statusCounts = {
      on_time: 0,
      late: 0,
      absent: 0,
      out_of_bounds: 0,
    };
    
    for (let i = 0; i < eventCount; i++) {
      const userId = userIds[Math.floor(Math.random() * userIds.length)];
      const status = randomStatus();
      const checkIn = randomDateInPast(daysBack);
      const config = getEventConfig(status);
      
      // For non-absent events, sometimes add a check-out time
      let checkOut = null;
      if (status !== "absent" && Math.random() > 0.3) {
        checkOut = new Date(checkIn);
        checkOut.setHours(checkOut.getHours() + 8 + Math.floor(Math.random() * 2));
      }
      
      events.push({
        user_id: userId,
        organization_id: orgId,
        check_in: checkIn,
        check_out: checkOut,
        is_verified: config.isVerified,
        status: status,
        is_within_geofence: config.isWithinGeofence,
        source: config.source,
        latitude: config.latitude,
        longitude: config.longitude,
        distance_to_geofence_m: config.distanceToGeofence,
        face_confidence: config.faceConfidence,
        liveness_score: config.livenessScore,
        spoof_flag: config.spoofFlag,
        notes: config.notes,
      });
      
      statusCounts[status]++;
      
      // Progress indicator
      if ((i + 1) % 10 === 0 || i === eventCount - 1) {
        process.stdout.write(`\r   Progress: ${i + 1}/${eventCount} events prepared...`);
      }
    }
    
    console.log("\n\n💾 Inserting events into database...\n");
    
    // Insert in batches of 50 for better performance
    const batchSize = 50;
    let inserted = 0;
    
    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, Math.min(i + batchSize, events.length));
      await db.insert(attendance_event).values(batch);
      inserted += batch.length;
      process.stdout.write(`\r   Inserted: ${inserted}/${eventCount} events...`);
    }
    
    console.log("\n\n✅ All events created successfully!\n");
    console.log("╔═══════════════════════════════════════════════════════════╗");
    console.log("║                     Summary                               ║");
    console.log("╠═══════════════════════════════════════════════════════════╣");
    console.log(`║ Total Events:          ${String(eventCount).padEnd(38)} ║`);
    console.log(`║ Organization ID:       ${orgId.padEnd(38)} ║`);
    console.log(`║ Number of Users:       ${String(userIds.length).padEnd(38)} ║`);
    console.log("╠═══════════════════════════════════════════════════════════╣");
    console.log(`║ On Time:               ${String(statusCounts.on_time).padEnd(15)} (${((statusCounts.on_time / eventCount) * 100).toFixed(1)}%)${' '.repeat(14)} ║`);
    console.log(`║ Late:                  ${String(statusCounts.late).padEnd(15)} (${((statusCounts.late / eventCount) * 100).toFixed(1)}%)${' '.repeat(14)} ║`);
    console.log(`║ Absent:                ${String(statusCounts.absent).padEnd(15)} (${((statusCounts.absent / eventCount) * 100).toFixed(1)}%)${' '.repeat(14)} ║`);
    console.log(`║ Out of Bounds:         ${String(statusCounts.out_of_bounds).padEnd(15)} (${((statusCounts.out_of_bounds / eventCount) * 100).toFixed(1)}%)${' '.repeat(14)} ║`);
    console.log("╚═══════════════════════════════════════════════════════════╝");
    console.log("\n");
    
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error generating bulk attendance events:", error);
    process.exit(1);
  }
}

// Run the script
generateBulkAttendance();


