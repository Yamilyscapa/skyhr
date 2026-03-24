CREATE TABLE "organization_billing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"stripe_subscription_status" text DEFAULT 'inactive' NOT NULL,
	"stripe_base_price_id" text,
	"stripe_overage_price_id" text,
	"stripe_base_subscription_item_id" text,
	"stripe_overage_subscription_item_id" text,
	"seat_count" integer DEFAULT 1 NOT NULL,
	"overage_quantity" integer DEFAULT 0 NOT NULL,
	"current_tier_key" text DEFAULT 'tier_1_20' NOT NULL,
	"monthly_amount_mxn" integer DEFAULT 1500 NOT NULL,
	"currency" text DEFAULT 'mxn' NOT NULL,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"last_synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_billing_organization_id_unique" UNIQUE("organization_id"),
	CONSTRAINT "organization_billing_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "organization_billing_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "stripe_webhook_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stripe_event_id" text NOT NULL,
	"type" text NOT NULL,
	"organization_id" text,
	"payload" text,
	"processed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stripe_webhook_event_stripe_event_id_unique" UNIQUE("stripe_event_id")
);
--> statement-breakpoint
ALTER TABLE "organization_billing" ADD CONSTRAINT "organization_billing_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stripe_webhook_event" ADD CONSTRAINT "stripe_webhook_event_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;
