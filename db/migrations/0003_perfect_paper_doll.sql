ALTER TABLE "seller_attachments" ADD COLUMN "product_id" text;--> statement-breakpoint
CREATE INDEX "seller_attachments_product_idx" ON "seller_attachments" USING btree ("owner_id","product_id");