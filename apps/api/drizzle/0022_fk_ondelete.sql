-- P3: Add ON DELETE policies to foreign keys left at NO ACTION.
-- Hand-written (drizzle journal out of sync; do NOT regenerate via db:generate).
-- DROP + re-ADD each FK with an explicit policy. Brief ACCESS EXCLUSIVE lock per
-- table while the new constraint validates; tables are small, safe in one txn.
--   cascade  = child belongs to parent (tenant / ownership): purge with parent.
--   set null = reference is optional metadata: keep the row, drop the link.

BEGIN;

-- auth: account/session belong to the user -----------------------------------
ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "accounts_userId_users_id_fk";
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_users_id_fk"
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_userId_users_id_fk";
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_users_id_fk"
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_impersonatedBy_users_id_fk";
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_impersonatedBy_users_id_fk"
  FOREIGN KEY ("impersonatedBy") REFERENCES users(id) ON DELETE SET NULL;

-- attendance: keep history; null out user/location/shift, purge with org ------
ALTER TABLE "attendance_event" DROP CONSTRAINT IF EXISTS "attendance_event_user_id_users_id_fk";
ALTER TABLE "attendance_event" ADD CONSTRAINT "attendance_event_user_id_users_id_fk"
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE "attendance_event" DROP CONSTRAINT IF EXISTS "attendance_event_location_id_geofence_id_fk";
ALTER TABLE "attendance_event" ADD CONSTRAINT "attendance_event_location_id_geofence_id_fk"
  FOREIGN KEY (location_id) REFERENCES geofence(id) ON DELETE SET NULL;

ALTER TABLE "attendance_event" DROP CONSTRAINT IF EXISTS "attendance_event_shift_id_shift_id_fk";
ALTER TABLE "attendance_event" ADD CONSTRAINT "attendance_event_shift_id_shift_id_fk"
  FOREIGN KEY (shift_id) REFERENCES shift(id) ON DELETE SET NULL;

ALTER TABLE "attendance_event" DROP CONSTRAINT IF EXISTS "attendance_event_organization_id_organization_id_fk";
ALTER TABLE "attendance_event" ADD CONSTRAINT "attendance_event_organization_id_organization_id_fk"
  FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE;

-- org-scoped config: purge with org ------------------------------------------
ALTER TABLE "geofence" DROP CONSTRAINT IF EXISTS "geofence_organization_id_organization_id_fk";
ALTER TABLE "geofence" ADD CONSTRAINT "geofence_organization_id_organization_id_fk"
  FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE;

ALTER TABLE "shift" DROP CONSTRAINT IF EXISTS "shift_organization_id_organization_id_fk";
ALTER TABLE "shift" ADD CONSTRAINT "shift_organization_id_organization_id_fk"
  FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE;

ALTER TABLE "organization_settings" DROP CONSTRAINT IF EXISTS "organization_settings_organization_id_organization_id_fk";
ALTER TABLE "organization_settings" ADD CONSTRAINT "organization_settings_organization_id_organization_id_fk"
  FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE;

-- schedule assignment: belongs to user/shift/org -----------------------------
ALTER TABLE "user_schedule" DROP CONSTRAINT IF EXISTS "user_schedule_user_id_users_id_fk";
ALTER TABLE "user_schedule" ADD CONSTRAINT "user_schedule_user_id_users_id_fk"
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE "user_schedule" DROP CONSTRAINT IF EXISTS "user_schedule_shift_id_shift_id_fk";
ALTER TABLE "user_schedule" ADD CONSTRAINT "user_schedule_shift_id_shift_id_fk"
  FOREIGN KEY (shift_id) REFERENCES shift(id) ON DELETE CASCADE;

ALTER TABLE "user_schedule" DROP CONSTRAINT IF EXISTS "user_schedule_organization_id_organization_id_fk";
ALTER TABLE "user_schedule" ADD CONSTRAINT "user_schedule_organization_id_organization_id_fk"
  FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE;

-- payroll: belongs to user ---------------------------------------------------
ALTER TABLE "user_payroll" DROP CONSTRAINT IF EXISTS "user_payroll_user_id_users_id_fk";
ALTER TABLE "user_payroll" ADD CONSTRAINT "user_payroll_user_id_users_id_fk"
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- permissions: belongs to user/org; approver is optional metadata ------------
ALTER TABLE "permissions" DROP CONSTRAINT IF EXISTS "permissions_user_id_users_id_fk";
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_user_id_users_id_fk"
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE "permissions" DROP CONSTRAINT IF EXISTS "permissions_organization_id_organization_id_fk";
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_organization_id_organization_id_fk"
  FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE;

ALTER TABLE "permissions" DROP CONSTRAINT IF EXISTS "permissions_approved_by_users_id_fk";
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_approved_by_users_id_fk"
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL;

-- invitation: keep invite if its target team is deleted ----------------------
ALTER TABLE "invitation" DROP CONSTRAINT IF EXISTS "invitation_team_id_team_id_fk";
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_team_id_team_id_fk"
  FOREIGN KEY (team_id) REFERENCES team(id) ON DELETE SET NULL;

-- visitors: approver is optional metadata ------------------------------------
ALTER TABLE "visitors" DROP CONSTRAINT IF EXISTS "visitors_approved_by_user_id_users_id_fk";
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_approved_by_user_id_users_id_fk"
  FOREIGN KEY (approved_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- organization: keep org if its subscription row is deleted ------------------
ALTER TABLE "organization" DROP CONSTRAINT IF EXISTS "organization_subscription_id_subscription_id_fk";
ALTER TABLE "organization" ADD CONSTRAINT "organization_subscription_id_subscription_id_fk"
  FOREIGN KEY (subscription_id) REFERENCES subscription(id) ON DELETE SET NULL;

COMMIT;
