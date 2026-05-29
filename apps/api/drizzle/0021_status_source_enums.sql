-- P2a: Convert free-text status/source/type columns to pgEnum.
-- Hand-written (drizzle journal out of sync; do NOT regenerate via db:generate).
-- Enum members backfilled from prod DISTINCT() so every existing row casts cleanly.
-- ALTER ... TYPE takes ACCESS EXCLUSIVE + rewrites the table -> brief lock.
-- Safe to wrap in a transaction (unlike the CONCURRENTLY indexes in 0020).

BEGIN;

CREATE TYPE "attendance_status" AS ENUM (
  'on_time', 'late', 'early', 'absent', 'out_of_bounds'
);
CREATE TYPE "attendance_source" AS ENUM (
  'face', 'fingerprint', 'qr_face', 'system', 'watch_mode'
);
CREATE TYPE "geofence_type" AS ENUM ('circular', 'polygon');

-- attendance_event.status (has a default -> drop, convert, re-add)
ALTER TABLE "attendance_event" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "attendance_event"
  ALTER COLUMN "status" TYPE "attendance_status"
  USING "status"::"attendance_status";
ALTER TABLE "attendance_event"
  ALTER COLUMN "status" SET DEFAULT 'on_time';

-- attendance_event.source (no default)
ALTER TABLE "attendance_event"
  ALTER COLUMN "source" TYPE "attendance_source"
  USING "source"::"attendance_source";

-- geofence.type (no default)
ALTER TABLE "geofence"
  ALTER COLUMN "type" TYPE "geofence_type"
  USING "type"::"geofence_type";

COMMIT;
