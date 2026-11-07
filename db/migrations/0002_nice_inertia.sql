CREATE TABLE "seller_marketplace_auth_states" (
	"state_hash" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"platform" text NOT NULL,
	"app_fingerprint" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seller_marketplace_connections" (
	"owner_id" text NOT NULL,
	"platform" text NOT NULL,
	"connection_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"token_ciphertext" text NOT NULL,
	"app_fingerprint" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seller_marketplace_connections_owner_id_platform_pk" PRIMARY KEY("owner_id","platform")
);
--> statement-breakpoint
CREATE INDEX "seller_marketplace_state_owner_idx" ON "seller_marketplace_auth_states" USING btree ("owner_id");