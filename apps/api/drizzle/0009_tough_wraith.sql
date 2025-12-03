CREATE TYPE "public"."visitor_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TABLE "visitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"access_areas" text NOT NULL,
	"entry_date" timestamp NOT NULL,
	"exit_date" timestamp NOT NULL,
	"status" "visitor_status" DEFAULT 'pending' NOT NULL,
	"approved_by_user_id" text,
	"approved_at" timestamp,
	"created_by_user_id" text NOT NULL,
	"qr_token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "visitors_qr_token_unique" UNIQUE("qr_token")
);
--> statement-breakpoint
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;