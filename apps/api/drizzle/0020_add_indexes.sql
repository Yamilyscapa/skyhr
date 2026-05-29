-- P0: Add missing indexes (foreign keys, tenant composites, partial).
-- Hand-written (drizzle journal is out of sync; do NOT regenerate via db:generate).
-- CONCURRENTLY = no table lock on a live DB. MUST run OUTSIDE a transaction
-- (psql autocommit / individual statements). Do not wrap in BEGIN/COMMIT.

-- attendance_event (hottest table) ------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS "attendance_event_user_idx"
  ON "attendance_event" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "attendance_event_org_checkin_idx"
  ON "attendance_event" ("organization_id", "check_in");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "attendance_event_org_status_idx"
  ON "attendance_event" ("organization_id", "status");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "attendance_event_shift_idx"
  ON "attendance_event" ("shift_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "attendance_event_location_idx"
  ON "attendance_event" ("location_id");
-- "currently checked in" lookups (check_out IS NULL)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "attendance_event_open_idx"
  ON "attendance_event" ("user_id") WHERE "check_out" IS NULL;

-- auth core -----------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS "sessions_user_idx"
  ON "sessions" ("userId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "accounts_user_idx"
  ON "accounts" ("userId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "verification_tokens_identifier_idx"
  ON "verificationTokens" ("identifier");

-- org plugin ----------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS "member_org_idx"
  ON "member" ("organization_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "member_user_idx"
  ON "member" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "invitation_org_idx"
  ON "invitation" ("organization_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "invitation_email_idx"
  ON "invitation" ("email");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "team_org_idx"
  ON "team" ("organization_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "team_member_team_idx"
  ON "team_member" ("team_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "team_member_user_idx"
  ON "team_member" ("user_id");

-- geofence / scheduling -----------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS "geofence_org_idx"
  ON "geofence" ("organization_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "user_geofence_user_idx"
  ON "user_geofence" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "user_geofence_geofence_idx"
  ON "user_geofence" ("geofence_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "user_geofence_org_idx"
  ON "user_geofence" ("organization_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "shift_org_idx"
  ON "shift" ("organization_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "user_schedule_user_idx"
  ON "user_schedule" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "user_schedule_shift_idx"
  ON "user_schedule" ("shift_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "user_schedule_org_effective_idx"
  ON "user_schedule" ("organization_id", "effective_from");

-- permissions ---------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS "permissions_user_idx"
  ON "permissions" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "permissions_org_status_idx"
  ON "permissions" ("organization_id", "status");

-- announcements -------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS "announcement_org_idx"
  ON "announcement" ("organization_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "announcement_teams_announcement_idx"
  ON "announcement_teams" ("announcement_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "announcement_teams_team_idx"
  ON "announcement_teams" ("team_id");

-- visitors ------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS "visitors_org_status_idx"
  ON "visitors" ("organization_id", "status");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "visitors_created_by_idx"
  ON "visitors" ("created_by_user_id");

-- payroll / billing ---------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS "user_payroll_user_idx"
  ON "user_payroll" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "stripe_webhook_event_org_idx"
  ON "stripe_webhook_event" ("organization_id");
