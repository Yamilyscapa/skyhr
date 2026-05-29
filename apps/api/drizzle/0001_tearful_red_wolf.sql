ALTER TABLE "attendance_event" ALTER COLUMN "latitude" SET DATA TYPE double precision USING "latitude"::double precision;--> statement-breakpoint
ALTER TABLE "attendance_event" ALTER COLUMN "longitude" SET DATA TYPE double precision USING "longitude"::double precision;--> statement-breakpoint
ALTER TABLE "attendance_event" ALTER COLUMN "face_confidence" SET DATA TYPE double precision USING "face_confidence"::double precision;--> statement-breakpoint
ALTER TABLE "attendance_event" ALTER COLUMN "liveness_score" SET DATA TYPE double precision USING "liveness_score"::double precision;--> statement-breakpoint
ALTER TABLE "geofence" ALTER COLUMN "center_latitude" SET DATA TYPE double precision USING "center_latitude"::double precision;--> statement-breakpoint
ALTER TABLE "geofence" ALTER COLUMN "center_longitude" SET DATA TYPE double precision USING "center_longitude"::double precision;
