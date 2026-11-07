CREATE TABLE "seller_marketplace_sync_rows" (
	"owner_id" text NOT NULL,
	"run_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"source_order_id" text NOT NULL,
	"sku" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric NOT NULL,
	"ordered_on" date NOT NULL,
	"status" text NOT NULL,
	"buyer" text NOT NULL,
	"currency" text NOT NULL,
	CONSTRAINT "seller_marketplace_sync_rows_owner_id_run_id_position_pk" PRIMARY KEY("owner_id","run_id","position"),
	CONSTRAINT "seller_sync_rows_bounds" CHECK ("seller_marketplace_sync_rows"."position" between 0 and 999 and "seller_marketplace_sync_rows"."quantity" between 1 and 10000000 and "seller_marketplace_sync_rows"."unit_price" between 0 and 100000000 and "seller_marketplace_sync_rows"."currency"='PHP')
);
--> statement-breakpoint
CREATE TABLE "seller_marketplace_sync_runs" (
	"owner_id" text NOT NULL,
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"platform" text NOT NULL,
	"connection_id" uuid NOT NULL,
	"shop_cipher" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"from_date" date NOT NULL,
	"to_date" date NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"lease_token" uuid,
	"lease_until" timestamp with time zone,
	"rows_count" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	CONSTRAINT "seller_marketplace_sync_runs_owner_id_id_pk" PRIMARY KEY("owner_id","id"),
	CONSTRAINT "seller_sync_runs_bounds" CHECK ("seller_marketplace_sync_runs"."status" in ('queued','retrying','running','ready','failed','cancelled') and "seller_marketplace_sync_runs"."attempts" between 0 and 3 and "seller_marketplace_sync_runs"."rows_count" between 0 and 1000 and "seller_marketplace_sync_runs"."from_date"<="seller_marketplace_sync_runs"."to_date")
);
--> statement-breakpoint
CREATE TABLE "seller_marketplace_sync_settings" (
	"owner_id" text NOT NULL,
	"platform" text NOT NULL,
	"connection_id" uuid NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"interval_minutes" integer DEFAULT 360 NOT NULL,
	"lookback_days" integer DEFAULT 2 NOT NULL,
	"shop_cipher" text,
	"next_run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seller_marketplace_sync_settings_owner_id_platform_pk" PRIMARY KEY("owner_id","platform"),
	CONSTRAINT "seller_sync_settings_bounds" CHECK ("seller_marketplace_sync_settings"."platform" in ('lazada','tiktok') and "seller_marketplace_sync_settings"."interval_minutes" in (60,360,1440) and "seller_marketplace_sync_settings"."lookback_days" between 1 and 7)
);
--> statement-breakpoint
ALTER TABLE "seller_marketplace_sync_rows" ADD CONSTRAINT "seller_marketplace_sync_rows_owner_id_run_id_seller_marketplace_sync_runs_owner_id_id_fk" FOREIGN KEY ("owner_id","run_id") REFERENCES "public"."seller_marketplace_sync_runs"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_marketplace_sync_runs" ADD CONSTRAINT "seller_marketplace_sync_runs_owner_id_platform_seller_marketplace_sync_settings_owner_id_platform_fk" FOREIGN KEY ("owner_id","platform") REFERENCES "public"."seller_marketplace_sync_settings"("owner_id","platform") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "seller_sync_runs_owner_idx" ON "seller_marketplace_sync_runs" USING btree ("owner_id","platform","created_at","id");--> statement-breakpoint
CREATE INDEX "seller_sync_runs_claim_idx" ON "seller_marketplace_sync_runs" USING btree ("status","available_at");--> statement-breakpoint
CREATE UNIQUE INDEX "seller_sync_runs_active_unique" ON "seller_marketplace_sync_runs" USING btree ("owner_id","platform") WHERE "seller_marketplace_sync_runs"."status" in ('queued','retrying','running');--> statement-breakpoint
CREATE INDEX "seller_sync_settings_due_idx" ON "seller_marketplace_sync_settings" USING btree ("enabled","next_run_at");