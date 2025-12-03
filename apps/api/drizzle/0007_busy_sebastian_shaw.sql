CREATE TYPE "public"."announcement_priority" AS ENUM('normal', 'important', 'urgent');--> statement-breakpoint
ALTER TABLE "announcement" DROP CONSTRAINT "announcement_organization_id_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "announcement" ALTER COLUMN "scope" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "announcement" ALTER COLUMN "category" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "announcement" ADD COLUMN "priority" "announcement_priority" DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "announcement" ADD COLUMN "published_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "announcement" ADD COLUMN "expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "announcement" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "announcement" ADD CONSTRAINT "announcement_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;