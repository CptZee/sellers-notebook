CREATE TABLE "seller_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"purpose" text NOT NULL,
	"scope" text NOT NULL,
	"token_hash" text NOT NULL,
	"prefix" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "seller_api_keys_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "seller_api_keys" ADD CONSTRAINT "seller_api_keys_owner_id_seller_notebooks_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."seller_notebooks"("owner_id") ON DELETE cascade ON UPDATE no action;