CREATE TABLE "seller_attachments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"object_key" text NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seller_attachments_object_key_unique" UNIQUE("object_key")
);
--> statement-breakpoint
CREATE TABLE "seller_notebooks" (
	"owner_id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"document" jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "seller_attachments_owner_idx" ON "seller_attachments" USING btree ("owner_id");