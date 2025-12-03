CREATE TYPE "public"."permission_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
ALTER TABLE "permissions" ALTER COLUMN "documents_url" SET DATA TYPE text[];--> statement-breakpoint
ALTER TABLE "permissions" ALTER COLUMN "documents_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "permissions" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "permissions" ADD COLUMN "status" "permission_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "permissions" ADD COLUMN "approved_by" text;--> statement-breakpoint
ALTER TABLE "permissions" ADD COLUMN "supervisor_comment" text;--> statement-breakpoint
ALTER TABLE "permissions" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permissions" DROP COLUMN "is_approved";