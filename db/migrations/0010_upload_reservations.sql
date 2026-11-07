CREATE TABLE "seller_storage_reservations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"object_key" text NOT NULL,
	"bytes" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seller_storage_reservations_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "seller_storage_reservation_bytes_check" CHECK ("seller_storage_reservations"."bytes" between 1 and 5242880)
);
--> statement-breakpoint
ALTER TABLE "seller_storage_reservations" ADD CONSTRAINT "seller_storage_reservations_owner_id_seller_notebooks_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."seller_notebooks"("owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "seller_storage_reservations_owner_idx" ON "seller_storage_reservations" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE TRIGGER seller_account_active BEFORE INSERT OR UPDATE ON seller_storage_reservations FOR EACH ROW EXECUTE FUNCTION seller_assert_account_active();
