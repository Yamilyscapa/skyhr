import "dotenv/config";
import { db } from "../src/db/index";
import { attendance_event, users, member, organization } from "../src/db/schema";
import { eq } from "drizzle-orm";

const userId = process.argv[2] || "2uJGuHdtRgVZrPXGZr8kg4yxagDiNhUD";
const orgId = process.argv[3]; // Optional organization ID parameter
const eventStatus = process.argv[4]; // Optional status: "on_time", "late", "absent", "out_of_bounds"

async function generateTestAttendance() {
  try {
    // Validate status parameter
    const validStatuses = ["on_time", "late", "absent", "out_of_bounds"];
    const status = eventStatus && validStatuses.includes(eventStatus) ? eventStatus : "on_time";
    
    console.log(`\n🔍 Generating test attendance event for user: ${userId}`);
    console.log(`📊 Event status: ${status}`);
    if (orgId) {
      console.log(`📍 Using organization ID: ${orgId}\n`);
    } else {
      console.log(`📍 Will use user's existing organization or create new one\n`);
    }
    
    // Check if user exists
    const userRows = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    if (userRows.length === 0) {
      console.log(`⚠️  User ${userId} not found. Creating user...`);
      
      // Create the test user
      const newUser = await db
        .insert(users)
        .values({
          id: userId,
          name: "Test User",
          email: `test.user.${Date.now()}@skyhr.com`,
          emailVerified: true,
        })
        .returning();
      
      if (newUser && newUser[0]) {
        console.log(`✅ User created: ${newUser[0].name} (${newUser[0].email})`);
      } else {
        console.error("❌ Failed to create user");
        process.exit(1);
      }
    }
    
    // Re-fetch user to ensure we have the latest data
    const updatedUserRows = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    const user = updatedUserRows[0];
    console.log(`✅ User found: ${user.name} (${user.email})`);
    
    // Determine which organization to use
    let organizationId: string;
    
    if (orgId) {
      // Use the provided organization ID
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
            slug: `org-${Date.now()}`,
            createdAt: new Date(),
            is_active: true,
          })
          .returning();
        
        if (newOrg && newOrg[0]) {
          console.log(`✅ Organization created: ${newOrg[0].name} (${newOrg[0].id})`);
        }
      } else {
        console.log(`✅ Organization found: ${orgRows[0].name} (${orgRows[0].id})`);
      }
      
      organizationId = orgId;
      
      // Ensure user is a member of this organization
      const memberRows = await db
        .select()
        .from(member)
        .where(eq(member.userId, userId))
        .limit(1);
      
      const isMember = memberRows.some(m => m.organizationId === orgId);
      
      if (!isMember) {
        console.log(`⚠️  User is not a member of organization ${orgId}. Adding membership...`);
        
        const newMembership = await db
          .insert(member)
          .values({
            id: `member-${Date.now()}`,
            userId: userId,
            organizationId: organizationId,
            role: "member",
            createdAt: new Date(),
          })
          .returning();
        
        if (newMembership && newMembership[0]) {
          console.log(`✅ User added to organization as ${newMembership[0].role}`);
        }
      } else {
        console.log(`✅ User is already a member of this organization`);
      }
    } else {
      // Use user's existing organization or create a new one
      let memberRows = await db
        .select()
        .from(member)
        .where(eq(member.userId, userId))
        .limit(1);
      
      if (memberRows.length === 0) {
        console.log(`⚠️  User is not a member of any organization. Creating test organization...`);
        
        // Create a test organization
        const testOrgId = `test-org-${Date.now()}`;
        const newOrg = await db
          .insert(organization)
          .values({
            id: testOrgId,
            name: "Test Organization",
            slug: `test-org-${Date.now()}`,
            createdAt: new Date(),
            is_active: true,
          })
          .returning();
        
        if (newOrg && newOrg[0]) {
          console.log(`✅ Organization created: ${newOrg[0].name} (${newOrg[0].id})`);
          organizationId = newOrg[0].id;
          
          // Create membership
          const newMembership = await db
            .insert(member)
            .values({
              id: `member-${Date.now()}`,
              userId: userId,
              organizationId: organizationId,
              role: "member",
              createdAt: new Date(),
            })
            .returning();
          
          if (newMembership && newMembership[0]) {
            console.log(`✅ User added to organization as ${newMembership[0].role}`);
          }
        } else {
          console.error("❌ Failed to create organization");
          process.exit(1);
        }
      } else {
        const membership = memberRows[0];
        organizationId = membership.organizationId;
        console.log(`✅ User belongs to organization: ${organizationId}`);
      }
    }
    
    // Generate random coordinates near NYC for variety
    const baseLatitude = 40.7128;
    const baseLongitude = -74.0060;
    const randomOffset = () => (Math.random() - 0.5) * 0.01; // Small random offset
    
    // Create test attendance event with status-specific configuration
    const now = new Date();
    
    // Configure event based on status
    let isWithinGeofence = true;
    let isVerified = true;
    let source = "test";
    let notes = `Test ${status} attendance event generated via script at ${now.toISOString()}`;
    let distanceToGeofence = Math.floor(Math.random() * 50); // 0-50m
    
    switch (status) {
      case "late":
        notes = "Checked in 15 minutes late. Test event.";
        break;
      case "absent":
        isVerified = false;
        source = "system";
        notes = "Auto-marked absent. No check-in recorded. Test event.";
        break;
      case "out_of_bounds":
        isWithinGeofence = false;
        distanceToGeofence = 150 + Math.floor(Math.random() * 100); // 150-250m outside geofence
        notes = `Check-in ${distanceToGeofence}m from geofence. Out of allowed area. Test event.`;
        break;
      case "on_time":
      default:
        notes = `On-time check-in. Test event generated at ${now.toISOString()}`;
        break;
    }
    
    const testEvent = {
      user_id: userId,
      organization_id: organizationId,
      check_in: now,
      check_out: null,
      is_verified: isVerified,
      status: status,
      is_within_geofence: isWithinGeofence,
      source: source,
      latitude: String(baseLatitude + randomOffset()),
      longitude: String(baseLongitude + randomOffset()),
      distance_to_geofence_m: distanceToGeofence,
      face_confidence: String(90 + Math.random() * 10), // 90-100%
      liveness_score: String(95 + Math.random() * 5), // 95-100%
      spoof_flag: false,
      notes: notes,
    };
    
    console.log(`\n📝 Creating test attendance event...`);
    const inserted = await db
      .insert(attendance_event)
      .values(testEvent)
      .returning();
    
    if (inserted && inserted[0]) {
      const event = inserted[0];
      console.log("\n✅ Test attendance event created successfully!\n");
      console.log("╔═══════════════════════════════════════════════════════════════╗");
      console.log("║                     Event Details                             ║");
      console.log("╠═══════════════════════════════════════════════════════════════╣");
      console.log(`║ ID:                    ${event.id.padEnd(38)} ║`);
      console.log(`║ User ID:               ${event.user_id?.padEnd(38)} ║`);
      console.log(`║ Organization ID:       ${event.organization_id?.padEnd(38)} ║`);
      console.log("╠═══════════════════════════════════════════════════════════════╣");
      console.log(`║ Check-in:              ${event.check_in?.toISOString().padEnd(38)} ║`);
      console.log(`║ Check-out:             ${String(event.check_out ?? 'null').padEnd(38)} ║`);
      console.log(`║ Status:                ${event.status.padEnd(38)} ║`);
      console.log(`║ Is Verified:           ${String(event.is_verified).padEnd(38)} ║`);
      console.log("╠═══════════════════════════════════════════════════════════════╣");
      console.log(`║ Within Geofence:       ${String(event.is_within_geofence).padEnd(38)} ║`);
      console.log(`║ Latitude:              ${event.latitude?.padEnd(38)} ║`);
      console.log(`║ Longitude:             ${event.longitude?.padEnd(38)} ║`);
      console.log(`║ Distance to Geofence:  ${String(event.distance_to_geofence_m) + 'm'.padEnd(38)} ║`);
      console.log("╠═══════════════════════════════════════════════════════════════╣");
      console.log(`║ Source:                ${event.source?.padEnd(38)} ║`);
      console.log(`║ Face Confidence:       ${event.face_confidence?.padEnd(38)} ║`);
      console.log(`║ Liveness Score:        ${event.liveness_score?.padEnd(38)} ║`);
      console.log(`║ Spoof Flag:            ${String(event.spoof_flag).padEnd(38)} ║`);
      console.log("╠═══════════════════════════════════════════════════════════════╣");
      console.log(`║ Created At:            ${event.created_at?.toISOString().padEnd(38)} ║`);
      console.log("╚═══════════════════════════════════════════════════════════════╝");
      console.log("\n");
    } else {
      console.error("❌ Failed to create attendance event");
      process.exit(1);
    }
    
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error creating test attendance event:", error);
    process.exit(1);
  }
}

// Run the script
console.log("═══════════════════════════════════════════════════════════");
console.log("   Test Attendance Event Generator");
console.log("═══════════════════════════════════════════════════════════");
generateTestAttendance();

