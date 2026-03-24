# Scripts

Utility scripts for testing, development, and maintenance of the SkyHR API.

## Available Scripts

### `seed-statistics-workflow.ts`

Cleans up existing, noisy data and seeds deterministic, realistic workflow data (attendance events, schedules, geofence assignments, payroll) for the testing organization (`q70149aXHHWy3b3TNKhkxAYW64yvB6G7`). This script is primarily used to reliably verify the accuracy of the statistics module on the web dashboard.

#### Usage

```bash
cd apps/api
bun run scripts/seed-statistics-workflow.ts
```

#### What it does

- **Deletes** existing schedules, shifts, geofences, payroll data, and attendance events for the target organization.
- **Creates** two new geofences (Headquarters, Remote Office) and two shifts (Morning, Evening).
- **Assigns** schedules, geofences, and payroll configs (with hourly rates) to the existing users in the organization.
- **Generates** ~90 days of deterministic attendance events simulating various scenarios: `on_time`, `late`, `early`, `absent`, and `out_of_bounds`.
- **Computes** and prints the expected dashboard statistics over the last 30 days to the console to use as a baseline for UI comparison.

---

### `generate-test-attendance.ts`

Generates a test attendance event for a specified user. If the user doesn't exist, it will create the user and associated organization.

#### Usage

```bash
# Generate attendance event for default user
npx tsx scripts/generate-test-attendance.ts

# Generate attendance event for a specific user
npx tsx scripts/generate-test-attendance.ts <USER_ID>

# Generate attendance event for a specific user and organization
npx tsx scripts/generate-test-attendance.ts <USER_ID> <ORGANIZATION_ID>

# Generate attendance event with specific status
npx tsx scripts/generate-test-attendance.ts <USER_ID> <ORGANIZATION_ID> <STATUS>
```

**Available Statuses:**

- `on_time` - Normal check-in (default)
- `late` - Late check-in (flagged)
- `absent` - Absent/no check-in (flagged)
- `out_of_bounds` - Check-in outside geofence (flagged)

#### Examples

```bash
# Use default user (on_time status)
npx tsx scripts/generate-test-attendance.ts

# Specific user with on_time status
npx tsx scripts/generate-test-attendance.ts 2uJGuHdtRgVZrPXGZr8kg4yxagDiNhUD

# Specific user and organization with on_time status
npx tsx scripts/generate-test-attendance.ts 2uJGuHdtRgVZrPXGZr8kg4yxagDiNhUD 2uJGuHdtRgVZrPXGZr8kg4yxagDiNhUD

# Generate a LATE event
npx tsx scripts/generate-test-attendance.ts 2uJGuHdtRgVZrPXGZr8kg4yxagDiNhUD 2uJGuHdtRgVZrPXGZr8kg4yxagDiNhUD late

# Generate an ABSENT event
npx tsx scripts/generate-test-attendance.ts 2uJGuHdtRgVZrPXGZr8kg4yxagDiNhUD 2uJGuHdtRgVZrPXGZr8kg4yxagDiNhUD absent

# Generate an OUT OF BOUNDS event
npx tsx scripts/generate-test-attendance.ts 2uJGuHdtRgVZrPXGZr8kg4yxagDiNhUD 2uJGuHdtRgVZrPXGZr8kg4yxagDiNhUD out_of_bounds
```

#### What it creates

- **User** (if doesn't exist): Test user with verified email
- **Organization** (if user has no org): Test organization with the user as a member
- **Attendance Event**: Complete attendance record with:
  - Random geolocation coordinates (near NYC)
  - Biometric verification data (face confidence, liveness score)
  - Status marked as "on_time"
  - Within geofence boundaries
  - Random distance to geofence (0-50m)

#### Output

The script provides detailed output including:

- User information
- Organization details
- Complete attendance event data with all fields

#### Testing the Generated Events

After generating test attendance events, you can retrieve them using the API:

```bash
# Get all attendance events for an organization
curl -X GET "http://localhost:8080/attendance/events" \
  -H "Cookie: better-auth.session_token=YOUR_SESSION_TOKEN"

# Get events for a specific user
curl -X GET "http://localhost:8080/attendance/events?user_id=2uJGuHdtRgVZrPXGZr8kg4yxagDiNhUD" \
  -H "Cookie: better-auth.session_token=YOUR_SESSION_TOKEN"

# Filter by date range
curl -X GET "http://localhost:8080/attendance/events?start_date=2025-11-01&end_date=2025-11-30" \
  -H "Cookie: better-auth.session_token=YOUR_SESSION_TOKEN"

# Filter by status
curl -X GET "http://localhost:8080/attendance/events?status=on_time" \
  -H "Cookie: better-auth.session_token=YOUR_SESSION_TOKEN"
```

See [API_DOCUMENTATION.md](../API_DOCUMENTATION.md) for complete endpoint details.

## Requirements

- Node.js/Bun runtime
- Database connection configured in `.env` file
- `dotenv` package installed

## Adding New Scripts

When adding new utility scripts to this folder:

1. Use TypeScript for type safety
2. Import `dotenv/config` at the top for environment variables
3. Add clear console output with emojis for better readability
4. Handle errors gracefully with proper exit codes
5. Document the script in this README
