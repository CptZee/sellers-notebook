CREATE TABLE "seller_shopee_auth_states" (
	"state_hash" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seller_shopee_connections" (
	"owner_id" text PRIMARY KEY NOT NULL,
	"connection_id" uuid NOT NULL,
	"shop_id" text NOT NULL,
	"environment" text NOT NULL,
	"token_ciphertext" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"refresh_locked_until" timestamp with time zone,
	"last_fetched_at" timestamp with time zone,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "seller_shopee_state_owner_idx" ON "seller_shopee_auth_states" USING btree ("owner_id");