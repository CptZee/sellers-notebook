CREATE TABLE "seller_customer_refunds" (
	"owner_id" text NOT NULL,
	"id" text NOT NULL,
	"sort_order" numeric NOT NULL,
	"order_id" text NOT NULL,
	"amount" numeric NOT NULL,
	"refunded_on" date NOT NULL,
	"reason" text NOT NULL,
	CONSTRAINT "seller_customer_refunds_owner_id_id_pk" PRIMARY KEY("owner_id","id"),
	CONSTRAINT "seller_customer_refunds_amount_check" CHECK ("seller_customer_refunds"."amount">0 and "seller_customer_refunds"."amount"=round("seller_customer_refunds"."amount",2))
);

--> statement-breakpoint
CREATE TABLE "seller_expenses" (
	"owner_id" text NOT NULL,
	"id" text NOT NULL,
	"sort_order" numeric NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"amount" numeric NOT NULL,
	"spent_on" date NOT NULL,
	"channel" text NOT NULL,
	"notes" text NOT NULL,
	CONSTRAINT "seller_expenses_owner_id_id_pk" PRIMARY KEY("owner_id","id"),
	CONSTRAINT "seller_expenses_amount_check" CHECK ("seller_expenses"."amount">0 and "seller_expenses"."amount"=round("seller_expenses"."amount",2))
);

--> statement-breakpoint
CREATE TABLE "seller_orders" (
	"owner_id" text NOT NULL,
	"id" text NOT NULL,
	"sort_order" numeric NOT NULL,
	"product_id" text NOT NULL,
	"product_name" text NOT NULL,
	"customer" text NOT NULL,
	"channel" text NOT NULL,
	"quantity" integer NOT NULL,
	"price" numeric NOT NULL,
	"cost" numeric NOT NULL,
	"fee" numeric NOT NULL,
	"packaging" numeric NOT NULL,
	"shipping" numeric NOT NULL,
	"ordered_on" date NOT NULL,
	"status" text NOT NULL,
	"source_order_id" text,
	"source_order_key" text GENERATED ALWAYS AS (upper(btrim(source_order_id))) STORED,
	"stock_applied" boolean,
	CONSTRAINT "seller_orders_owner_id_id_pk" PRIMARY KEY("owner_id","id"),
	CONSTRAINT "seller_orders_status_check" CHECK ("seller_orders"."status" in ('Processing','Completed','Cancelled')),
	CONSTRAINT "seller_orders_quantity_check" CHECK ("seller_orders"."quantity" between 1 and 10000000),
	CONSTRAINT "seller_orders_money_check" CHECK ("seller_orders"."price">=0 and "seller_orders"."cost">=0 and "seller_orders"."packaging">=0 and "seller_orders"."shipping">=0 and "seller_orders"."fee">=0 and "seller_orders"."fee"<100)
);

--> statement-breakpoint
CREATE TABLE "seller_products" (
	"owner_id" text NOT NULL,
	"id" text NOT NULL,
	"sort_order" numeric NOT NULL,
	"name" text NOT NULL,
	"sku" text NOT NULL,
	"sku_key" text GENERATED ALWAYS AS (lower(sku)) STORED,
	"category" text NOT NULL,
	"cost" numeric NOT NULL,
	"price" numeric NOT NULL,
	"stock" integer NOT NULL,
	"color" text NOT NULL,
	"symbol" text NOT NULL,
	"reorder_point" integer,
	"target_stock" integer,
	CONSTRAINT "seller_products_owner_id_id_pk" PRIMARY KEY("owner_id","id"),
	CONSTRAINT "seller_products_owner_sku_unique" UNIQUE("owner_id","sku_key"),
	CONSTRAINT "seller_products_stock_check" CHECK ("seller_products"."stock" between 0 and 10000000),
	CONSTRAINT "seller_products_money_check" CHECK ("seller_products"."cost">=0 and "seller_products"."price">=0)
);

--> statement-breakpoint
CREATE TABLE "seller_purchase_items" (
	"owner_id" text NOT NULL,
	"purchase_id" text NOT NULL,
	"product_id" text NOT NULL,
	"position" integer NOT NULL,
	"product_name" text NOT NULL,
	"sku" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_cost" numeric NOT NULL,
	"received_quantity" integer,
	CONSTRAINT "seller_purchase_items_owner_id_purchase_id_product_id_pk" PRIMARY KEY("owner_id","purchase_id","product_id"),
	CONSTRAINT "seller_purchase_items_quantity_check" CHECK ("seller_purchase_items"."quantity" between 1 and 10000000 and ("seller_purchase_items"."received_quantity" is null or "seller_purchase_items"."received_quantity" between 0 and "seller_purchase_items"."quantity") and "seller_purchase_items"."unit_cost">=0)
);

--> statement-breakpoint
CREATE TABLE "seller_purchase_orders" (
	"owner_id" text NOT NULL,
	"id" text NOT NULL,
	"sort_order" numeric NOT NULL,
	"reference" text NOT NULL,
	"supplier_id" text,
	"supplier_snapshot_id" text NOT NULL,
	"supplier_name" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expected_on" date,
	"notes" text NOT NULL,
	"status" text NOT NULL,
	"received_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "seller_purchase_orders_owner_id_id_pk" PRIMARY KEY("owner_id","id"),
	CONSTRAINT "seller_purchases_status_check" CHECK ("seller_purchase_orders"."status" in ('Ordered','Partially received','Received','Cancelled'))
);

--> statement-breakpoint
CREATE TABLE "seller_purchase_payments" (
	"owner_id" text NOT NULL,
	"purchase_id" text NOT NULL,
	"id" text NOT NULL,
	"position" integer NOT NULL,
	"amount" numeric NOT NULL,
	"recorded_on" date NOT NULL,
	"method" text NOT NULL,
	"reference" text NOT NULL,
	"notes" text NOT NULL,
	CONSTRAINT "seller_purchase_payments_owner_id_purchase_id_id_pk" PRIMARY KEY("owner_id","purchase_id","id"),
	CONSTRAINT "seller_purchase_payments_amount_check" CHECK ("seller_purchase_payments"."amount">0 and "seller_purchase_payments"."amount"=round("seller_purchase_payments"."amount",2))
);

--> statement-breakpoint
CREATE TABLE "seller_stock_adjustments" (
	"owner_id" text NOT NULL,
	"id" text NOT NULL,
	"sort_order" numeric NOT NULL,
	"product_id" text NOT NULL,
	"product_name" text NOT NULL,
	"sku" text NOT NULL,
	"kind" text NOT NULL,
	"before" integer NOT NULL,
	"after" integer NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"purchase_id" text,
	CONSTRAINT "seller_stock_adjustments_owner_id_id_pk" PRIMARY KEY("owner_id","id"),
	CONSTRAINT "seller_stock_adjustments_quantity_check" CHECK ("seller_stock_adjustments"."before" between 0 and 10000000 and "seller_stock_adjustments"."after" between 0 and 10000000 and "seller_stock_adjustments"."before"<>"seller_stock_adjustments"."after"),
	CONSTRAINT "seller_stock_adjustments_kind_check" CHECK ("seller_stock_adjustments"."kind" in ('Restock','Damage','Correction'))
);

--> statement-breakpoint
CREATE TABLE "seller_supplier_products" (
	"owner_id" text NOT NULL,
	"supplier_id" text NOT NULL,
	"product_id" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "seller_supplier_products_owner_id_supplier_id_product_id_pk" PRIMARY KEY("owner_id","supplier_id","product_id")
);

--> statement-breakpoint
CREATE TABLE "seller_supplier_refunds" (
	"owner_id" text NOT NULL,
	"purchase_id" text NOT NULL,
	"id" text NOT NULL,
	"position" integer NOT NULL,
	"amount" numeric NOT NULL,
	"recorded_on" date NOT NULL,
	"method" text NOT NULL,
	"reference" text NOT NULL,
	"notes" text NOT NULL,
	CONSTRAINT "seller_supplier_refunds_owner_id_purchase_id_id_pk" PRIMARY KEY("owner_id","purchase_id","id"),
	CONSTRAINT "seller_supplier_refunds_amount_check" CHECK ("seller_supplier_refunds"."amount">0 and "seller_supplier_refunds"."amount"=round("seller_supplier_refunds"."amount",2))
);

--> statement-breakpoint
CREATE TABLE "seller_suppliers" (
	"owner_id" text NOT NULL,
	"id" text NOT NULL,
	"sort_order" numeric NOT NULL,
	"name" text NOT NULL,
	"contact" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"address" text NOT NULL,
	"notes" text NOT NULL,
	"lead_time_days" integer NOT NULL,
	CONSTRAINT "seller_suppliers_owner_id_id_pk" PRIMARY KEY("owner_id","id"),
	CONSTRAINT "seller_suppliers_lead_time_check" CHECK ("seller_suppliers"."lead_time_days" between 0 and 3650)
);

--> statement-breakpoint
ALTER TABLE "seller_notebooks" ADD COLUMN "sidebar_note" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "seller_notebooks" ADD COLUMN "business_name" text;
--> statement-breakpoint
ALTER TABLE "seller_notebooks" ADD COLUMN "notebook_title" text;
--> statement-breakpoint
ALTER TABLE "seller_notebooks" ADD COLUMN "tagline" text;
--> statement-breakpoint
ALTER TABLE "seller_notebooks" ADD COLUMN "icon" text;
--> statement-breakpoint
ALTER TABLE "seller_customer_refunds" ADD CONSTRAINT "seller_customer_refunds_owner_id_seller_notebooks_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."seller_notebooks"("owner_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "seller_customer_refunds" ADD CONSTRAINT "seller_customer_refunds_owner_id_order_id_seller_orders_owner_id_id_fk" FOREIGN KEY ("owner_id","order_id") REFERENCES "public"."seller_orders"("owner_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "seller_expenses" ADD CONSTRAINT "seller_expenses_owner_id_seller_notebooks_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."seller_notebooks"("owner_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "seller_orders" ADD CONSTRAINT "seller_orders_owner_id_seller_notebooks_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."seller_notebooks"("owner_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "seller_orders" ADD CONSTRAINT "seller_orders_owner_id_product_id_seller_products_owner_id_id_fk" FOREIGN KEY ("owner_id","product_id") REFERENCES "public"."seller_products"("owner_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "seller_products" ADD CONSTRAINT "seller_products_owner_id_seller_notebooks_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."seller_notebooks"("owner_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "seller_purchase_items" ADD CONSTRAINT "seller_purchase_items_owner_id_seller_notebooks_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."seller_notebooks"("owner_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "seller_purchase_items" ADD CONSTRAINT "seller_purchase_items_owner_id_purchase_id_seller_purchase_orders_owner_id_id_fk" FOREIGN KEY ("owner_id","purchase_id") REFERENCES "public"."seller_purchase_orders"("owner_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "seller_purchase_items" ADD CONSTRAINT "seller_purchase_items_owner_id_product_id_seller_products_owner_id_id_fk" FOREIGN KEY ("owner_id","product_id") REFERENCES "public"."seller_products"("owner_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "seller_purchase_orders" ADD CONSTRAINT "seller_purchase_orders_owner_id_seller_notebooks_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."seller_notebooks"("owner_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "seller_purchase_orders" ADD CONSTRAINT "seller_purchases_supplier_fk" FOREIGN KEY ("owner_id","supplier_id") REFERENCES "public"."seller_suppliers"("owner_id","id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "seller_purchase_payments" ADD CONSTRAINT "seller_purchase_payments_owner_id_seller_notebooks_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."seller_notebooks"("owner_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "seller_purchase_payments" ADD CONSTRAINT "seller_purchase_payments_owner_id_purchase_id_seller_purchase_orders_owner_id_id_fk" FOREIGN KEY ("owner_id","purchase_id") REFERENCES "public"."seller_purchase_orders"("owner_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "seller_stock_adjustments" ADD CONSTRAINT "seller_stock_adjustments_owner_id_seller_notebooks_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."seller_notebooks"("owner_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "seller_stock_adjustments" ADD CONSTRAINT "seller_stock_adjustments_owner_id_product_id_seller_products_owner_id_id_fk" FOREIGN KEY ("owner_id","product_id") REFERENCES "public"."seller_products"("owner_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "seller_stock_adjustments" ADD CONSTRAINT "seller_stock_adjustments_owner_id_purchase_id_seller_purchase_orders_owner_id_id_fk" FOREIGN KEY ("owner_id","purchase_id") REFERENCES "public"."seller_purchase_orders"("owner_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "seller_supplier_products" ADD CONSTRAINT "seller_supplier_products_owner_id_seller_notebooks_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."seller_notebooks"("owner_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "seller_supplier_products" ADD CONSTRAINT "seller_supplier_products_owner_id_supplier_id_seller_suppliers_owner_id_id_fk" FOREIGN KEY ("owner_id","supplier_id") REFERENCES "public"."seller_suppliers"("owner_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "seller_supplier_products" ADD CONSTRAINT "seller_supplier_products_owner_id_product_id_seller_products_owner_id_id_fk" FOREIGN KEY ("owner_id","product_id") REFERENCES "public"."seller_products"("owner_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "seller_supplier_refunds" ADD CONSTRAINT "seller_supplier_refunds_owner_id_seller_notebooks_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."seller_notebooks"("owner_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "seller_supplier_refunds" ADD CONSTRAINT "seller_supplier_refunds_owner_id_purchase_id_seller_purchase_orders_owner_id_id_fk" FOREIGN KEY ("owner_id","purchase_id") REFERENCES "public"."seller_purchase_orders"("owner_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "seller_suppliers" ADD CONSTRAINT "seller_suppliers_owner_id_seller_notebooks_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."seller_notebooks"("owner_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "seller_customer_refunds_order_idx" ON "seller_customer_refunds" USING btree ("owner_id","order_id");
--> statement-breakpoint
CREATE INDEX "seller_customer_refunds_date_idx" ON "seller_customer_refunds" USING btree ("owner_id","refunded_on");
--> statement-breakpoint
CREATE INDEX "seller_customer_refunds_sort_idx" ON "seller_customer_refunds" USING btree ("owner_id","sort_order");
--> statement-breakpoint
CREATE INDEX "seller_expenses_owner_date_idx" ON "seller_expenses" USING btree ("owner_id","spent_on");
--> statement-breakpoint
CREATE INDEX "seller_expenses_owner_sort_idx" ON "seller_expenses" USING btree ("owner_id","sort_order");
--> statement-breakpoint
CREATE INDEX "seller_orders_owner_date_idx" ON "seller_orders" USING btree ("owner_id","ordered_on");
--> statement-breakpoint
CREATE INDEX "seller_orders_owner_status_date_idx" ON "seller_orders" USING btree ("owner_id","status","ordered_on");
--> statement-breakpoint
CREATE INDEX "seller_orders_owner_source_idx" ON "seller_orders" USING btree ("owner_id","channel","source_order_key");
--> statement-breakpoint
CREATE INDEX "seller_orders_owner_sort_idx" ON "seller_orders" USING btree ("owner_id","sort_order");
--> statement-breakpoint
CREATE INDEX "seller_products_owner_sort_idx" ON "seller_products" USING btree ("owner_id","sort_order");
--> statement-breakpoint
CREATE INDEX "seller_purchase_items_product_idx" ON "seller_purchase_items" USING btree ("owner_id","product_id");
--> statement-breakpoint
CREATE INDEX "seller_purchases_owner_supplier_idx" ON "seller_purchase_orders" USING btree ("owner_id","supplier_snapshot_id");
--> statement-breakpoint
CREATE INDEX "seller_purchases_owner_status_date_idx" ON "seller_purchase_orders" USING btree ("owner_id","status","expected_on");
--> statement-breakpoint
CREATE INDEX "seller_purchases_owner_sort_idx" ON "seller_purchase_orders" USING btree ("owner_id","sort_order");
--> statement-breakpoint
CREATE INDEX "seller_stock_adjustments_product_idx" ON "seller_stock_adjustments" USING btree ("owner_id","product_id");
--> statement-breakpoint
CREATE INDEX "seller_stock_adjustments_purchase_idx" ON "seller_stock_adjustments" USING btree ("owner_id","purchase_id");
--> statement-breakpoint
CREATE INDEX "seller_stock_adjustments_sort_idx" ON "seller_stock_adjustments" USING btree ("owner_id","sort_order");
--> statement-breakpoint
CREATE INDEX "seller_supplier_products_product_idx" ON "seller_supplier_products" USING btree ("owner_id","product_id");
--> statement-breakpoint
CREATE INDEX "seller_suppliers_owner_name_idx" ON "seller_suppliers" USING btree ("owner_id","name");
--> statement-breakpoint
CREATE INDEX "seller_suppliers_owner_sort_idx" ON "seller_suppliers" USING btree ("owner_id","sort_order");
--> statement-breakpoint
-- RELATIONAL RUNTIME AND DATA CONVERSION
-- Preserve owner IDs when nullable composite relationships are cleared.
ALTER TABLE seller_purchase_orders DROP CONSTRAINT seller_purchases_supplier_fk;
ALTER TABLE seller_purchase_orders ADD CONSTRAINT seller_purchases_supplier_fk FOREIGN KEY(owner_id,supplier_id) REFERENCES seller_suppliers(owner_id,id) ON DELETE SET NULL (supplier_id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE seller_products DROP CONSTRAINT seller_products_owner_sku_unique;
ALTER TABLE seller_products ADD CONSTRAINT seller_products_owner_sku_unique UNIQUE(owner_id,sku_key) DEFERRABLE INITIALLY DEFERRED;
DO $$ DECLARE c record; BEGIN FOR c IN SELECT conrelid::regclass tab,conname FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace AND conrelid::regclass::text LIKE 'seller_%' LOOP EXECUTE format('ALTER TABLE %s ALTER CONSTRAINT %I DEFERRABLE INITIALLY DEFERRED',c.tab,c.conname); END LOOP; END $$;
ALTER TABLE seller_notebooks ADD CONSTRAINT seller_notebooks_branding_check CHECK ((business_name IS NULL AND notebook_title IS NULL AND tagline IS NULL AND icon IS NULL) OR (business_name IS NOT NULL AND notebook_title IS NOT NULL AND tagline IS NOT NULL AND icon IN ('notebook','store','sprout')));
ALTER TABLE seller_orders ADD CONSTRAINT seller_orders_channel_check CHECK(channel IN ('Shopee','Lazada','TikTok Shop','Direct'));
ALTER TABLE seller_expenses ADD CONSTRAINT seller_expenses_channel_check CHECK(channel IN ('Business','Shopee','Lazada','TikTok Shop','Direct'));
ALTER TABLE seller_expenses ADD CONSTRAINT seller_expenses_category_check CHECK(category IN ('Advertising','Software','Rent & utilities','Office supplies','Professional services','Other'));
ALTER TABLE seller_purchase_payments ADD CONSTRAINT seller_purchase_payments_method_check CHECK(method IN ('Bank transfer','E-wallet','Cash','Other'));
ALTER TABLE seller_supplier_refunds ADD CONSTRAINT seller_supplier_refunds_method_check CHECK(method IN ('Bank transfer','E-wallet','Cash','Other'));

--> statement-breakpoint
CREATE VIEW seller_purchase_item_records AS SELECT t.*,t.position AS ordinality,jsonb_strip_nulls(jsonb_build_object('productId',t."product_id",'productName',t."product_name",'sku',t."sku",'quantity',t."quantity",'unitCost',t."unit_cost",'receivedQuantity',t."received_quantity")) AS value FROM seller_purchase_items t;
--> statement-breakpoint
CREATE VIEW seller_purchase_payment_records AS SELECT t.*,t.position AS ordinality,jsonb_strip_nulls(jsonb_build_object('id',t."id",'amount',t."amount",'date',t."recorded_on"::text,'method',t."method",'reference',t."reference",'notes',t."notes")) AS value FROM seller_purchase_payments t;
--> statement-breakpoint
CREATE VIEW seller_supplier_refund_records AS SELECT t.*,t.position AS ordinality,jsonb_strip_nulls(jsonb_build_object('id',t."id",'amount',t."amount",'date',t."recorded_on"::text,'method',t."method",'reference',t."reference",'notes',t."notes")) AS value FROM seller_supplier_refunds t;
--> statement-breakpoint
CREATE VIEW seller_product_records AS SELECT t.*,t.sort_order AS ordinality,jsonb_strip_nulls(jsonb_build_object('id',t.id,'name',t."name",'sku',t."sku",'category',t."category",'cost',t."cost",'price',t."price",'stock',t."stock",'color',t."color",'symbol',t."symbol",'reorderPoint',t."reorder_point",'targetStock',t."target_stock")) AS value FROM seller_products t;
--> statement-breakpoint
CREATE VIEW seller_supplier_records AS SELECT t.*,t.sort_order AS ordinality,jsonb_strip_nulls(jsonb_build_object('id',t.id,'name',t."name",'contact',t."contact",'email',t."email",'phone',t."phone",'address',t."address",'notes',t."notes",'leadTimeDays',t."lead_time_days",'productIds',coalesce((select jsonb_agg(product_id order by position) from seller_supplier_products l where l.owner_id=t.owner_id and l.supplier_id=t.id),'[]'::jsonb))) AS value FROM seller_suppliers t;
--> statement-breakpoint
CREATE VIEW seller_order_records AS SELECT t.*,t.sort_order AS ordinality,jsonb_strip_nulls(jsonb_build_object('id',t.id,'productId',t."product_id",'productName',t."product_name",'customer',t."customer",'channel',t."channel",'quantity',t."quantity",'price',t."price",'cost',t."cost",'fee',t."fee",'packaging',t."packaging",'shipping',t."shipping",'date',t."ordered_on"::text,'status',t."status",'sourceOrderId',t."source_order_id",'stockApplied',t."stock_applied")) AS value FROM seller_orders t;
--> statement-breakpoint
CREATE VIEW seller_expense_records AS SELECT t.*,t.sort_order AS ordinality,jsonb_strip_nulls(jsonb_build_object('id',t.id,'title',t."title",'category',t."category",'amount',t."amount",'date',t."spent_on"::text,'channel',t."channel",'notes',t."notes")) AS value FROM seller_expenses t;
--> statement-breakpoint
CREATE VIEW seller_customer_refund_records AS SELECT t.*,t.sort_order AS ordinality,jsonb_strip_nulls(jsonb_build_object('id',t.id,'orderId',t."order_id",'amount',t."amount",'date',t."refunded_on"::text,'reason',t."reason")) AS value FROM seller_customer_refunds t;
--> statement-breakpoint
CREATE VIEW seller_purchase_records AS SELECT t.*,t.sort_order AS ordinality,jsonb_strip_nulls(jsonb_build_object('id',t.id,'reference',t."reference",'supplierId',t."supplier_snapshot_id",'supplierName',t."supplier_name",'createdAt',to_char(t."created_at" at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'expectedDate',coalesce(t."expected_on"::text,''),'notes',t."notes",'status',t."status",'receivedAt',to_char(t."received_at" at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'cancelledAt',to_char(t."cancelled_at" at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'items',coalesce((select jsonb_agg(value order by ordinality) from seller_purchase_item_records c where c.owner_id=t.owner_id and c.purchase_id=t.id),'[]'::jsonb),'payments',coalesce((select jsonb_agg(value order by ordinality) from seller_purchase_payment_records c where c.owner_id=t.owner_id and c.purchase_id=t.id),'[]'::jsonb),'supplierRefunds',coalesce((select jsonb_agg(value order by ordinality) from seller_supplier_refund_records c where c.owner_id=t.owner_id and c.purchase_id=t.id),'[]'::jsonb))) AS value FROM seller_purchase_orders t;
--> statement-breakpoint
CREATE VIEW seller_stock_adjustment_records AS SELECT t.*,t.sort_order AS ordinality,jsonb_strip_nulls(jsonb_build_object('id',t.id,'productId',t."product_id",'productName',t."product_name",'sku',t."sku",'kind',t."kind",'before',t."before",'after',t."after",'reason',t."reason",'createdAt',to_char(t."created_at" at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))) AS value FROM seller_stock_adjustments t;
--> statement-breakpoint
CREATE FUNCTION seller_notebook_snapshot(p_owner text) RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('sidebarNote',coalesce((select sidebar_note from seller_notebooks where owner_id=p_owner),''),'branding',(select case when business_name is null then null else jsonb_build_object('businessName',business_name,'notebookTitle',notebook_title,'tagline',tagline,'icon',icon) end from seller_notebooks where owner_id=p_owner),'products',coalesce((select jsonb_agg(value order by ordinality) from seller_product_records where owner_id=p_owner),'[]'::jsonb),'suppliers',coalesce((select jsonb_agg(value order by ordinality) from seller_supplier_records where owner_id=p_owner),'[]'::jsonb),'orders',coalesce((select jsonb_agg(value order by ordinality) from seller_order_records where owner_id=p_owner),'[]'::jsonb),'expenses',coalesce((select jsonb_agg(value order by ordinality) from seller_expense_records where owner_id=p_owner),'[]'::jsonb),'refundRecords',coalesce((select jsonb_agg(value order by ordinality) from seller_customer_refund_records where owner_id=p_owner),'[]'::jsonb),'purchaseOrders',coalesce((select jsonb_agg(value order by ordinality) from seller_purchase_records where owner_id=p_owner),'[]'::jsonb),'stockAdjustments',coalesce((select jsonb_agg(value order by ordinality) from seller_stock_adjustment_records where owner_id=p_owner),'[]'::jsonb)) $$;
--> statement-breakpoint
CREATE FUNCTION seller_commit_changes(p_owner text,p_revision integer,p_name text,p_changes jsonb) RETURNS TABLE(revision integer,"updatedAt" timestamptz,txid text) LANGUAGE plpgsql AS $$
DECLARE actual integer; k text; tab text; ch jsonb; entry jsonb; v jsonb; v_sort numeric; original_ids text[]; target_ids text[]; rid text; idx integer; prev_sort numeric; next_sort numeric;
BEGIN
 SET CONSTRAINTS ALL DEFERRED;
 SELECT n.revision INTO actual FROM seller_notebooks n WHERE n.owner_id=p_owner FOR UPDATE;
 IF NOT FOUND THEN
  IF p_revision<>0 THEN RETURN; END IF;
  INSERT INTO seller_notebooks(owner_id,display_name,revision) VALUES(p_owner,p_name,0) ON CONFLICT DO NOTHING;
  SELECT n.revision INTO actual FROM seller_notebooks n WHERE n.owner_id=p_owner FOR UPDATE;
 END IF;
 IF actual<>p_revision THEN RETURN; END IF;
 IF jsonb_typeof(p_changes)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_changes) x WHERE x NOT IN ('sidebarNote','branding','products','suppliers','orders','expenses','refundRecords','purchaseOrders','stockAdjustments')) THEN RAISE EXCEPTION 'Invalid record changes'; END IF;
 FOREACH k IN ARRAY ARRAY['products','suppliers','orders','expenses','refundRecords','purchaseOrders','stockAdjustments'] LOOP
  IF NOT(p_changes ? k) THEN CONTINUE; END IF;
  tab=CASE k WHEN 'products' THEN 'seller_products' WHEN 'suppliers' THEN 'seller_suppliers' WHEN 'orders' THEN 'seller_orders' WHEN 'expenses' THEN 'seller_expenses' WHEN 'refundRecords' THEN 'seller_customer_refunds' WHEN 'purchaseOrders' THEN 'seller_purchase_orders' WHEN 'stockAdjustments' THEN 'seller_stock_adjustments' END; ch=p_changes->k;
  EXECUTE format('SELECT coalesce(array_agg(id order by sort_order),ARRAY[]::text[]) FROM %I WHERE owner_id=$1',tab) INTO original_ids USING p_owner;
  EXECUTE format('DELETE FROM %I WHERE owner_id=$1 AND id=ANY(ARRAY(SELECT jsonb_array_elements_text($2)))',tab) USING p_owner,ch->'remove';
  target_ids=ARRAY(SELECT x FROM unnest(original_ids) x WHERE NOT(x=ANY(ARRAY(SELECT jsonb_array_elements_text(ch->'remove')))));
  FOR entry IN SELECT value FROM jsonb_array_elements(ch->'upsert') ORDER BY (value->>'index')::int LOOP
   v=entry->'record';rid=v->>'id';idx=(entry->>'index')::int;
   EXECUTE format('SELECT sort_order FROM %I WHERE owner_id=$1 AND id=$2',tab) INTO v_sort USING p_owner,rid;
   IF v_sort IS NULL THEN
    IF idx>cardinality(target_ids) THEN RAISE EXCEPTION 'Invalid record position'; END IF;
    prev_sort=NULL;next_sort=NULL;
    IF idx>0 THEN EXECUTE format('SELECT sort_order FROM %I WHERE owner_id=$1 AND id=$2',tab) INTO prev_sort USING p_owner,target_ids[idx]; END IF;
    IF idx<cardinality(target_ids) THEN EXECUTE format('SELECT sort_order FROM %I WHERE owner_id=$1 AND id=$2',tab) INTO next_sort USING p_owner,target_ids[idx+1]; END IF;
    v_sort=CASE WHEN prev_sort IS NULL AND next_sort IS NULL THEN 0 WHEN prev_sort IS NULL THEN next_sort-1 WHEN next_sort IS NULL THEN prev_sort+1 ELSE (prev_sort+next_sort)/2 END;
    target_ids=coalesce(target_ids[1:idx],ARRAY[]::text[])||ARRAY[rid]||coalesce(target_ids[idx+1:cardinality(target_ids)],ARRAY[]::text[]);
   END IF;
   CASE k WHEN 'products' THEN INSERT INTO seller_products(owner_id,"id","sort_order","name","sku","category","cost","price","stock","color","symbol","reorder_point","target_stock") VALUES(p_owner,v->>'id',v_sort,v->>'name',v->>'sku',v->>'category',nullif(v->>'cost','')::numeric,nullif(v->>'price','')::numeric,nullif(v->>'stock','')::integer,v->>'color',v->>'symbol',nullif(v->>'reorderPoint','')::integer,nullif(v->>'targetStock','')::integer) ON CONFLICT(owner_id,id) DO UPDATE SET "sort_order"=excluded."sort_order","name"=excluded."name","sku"=excluded."sku","category"=excluded."category","cost"=excluded."cost","price"=excluded."price","stock"=excluded."stock","color"=excluded."color","symbol"=excluded."symbol","reorder_point"=excluded."reorder_point","target_stock"=excluded."target_stock"; 
WHEN 'suppliers' THEN INSERT INTO seller_suppliers(owner_id,"id","sort_order","name","contact","email","phone","address","notes","lead_time_days") VALUES(p_owner,v->>'id',v_sort,v->>'name',v->>'contact',v->>'email',v->>'phone',v->>'address',v->>'notes',nullif(v->>'leadTimeDays','')::integer) ON CONFLICT(owner_id,id) DO UPDATE SET "sort_order"=excluded."sort_order","name"=excluded."name","contact"=excluded."contact","email"=excluded."email","phone"=excluded."phone","address"=excluded."address","notes"=excluded."notes","lead_time_days"=excluded."lead_time_days"; 
 DELETE FROM seller_supplier_products WHERE owner_id=p_owner AND supplier_id=v->>'id' AND NOT(product_id=ANY(ARRAY(SELECT jsonb_array_elements_text(v->'productIds'))));
 INSERT INTO seller_supplier_products(owner_id,supplier_id,product_id,position) SELECT p_owner,v->>'id',value,ordinality::int-1 FROM jsonb_array_elements_text(v->'productIds') WITH ORDINALITY ON CONFLICT(owner_id,supplier_id,product_id) DO UPDATE SET position=excluded.position WHERE seller_supplier_products.position<>excluded.position;
WHEN 'orders' THEN INSERT INTO seller_orders(owner_id,"id","sort_order","product_id","product_name","customer","channel","quantity","price","cost","fee","packaging","shipping","ordered_on","status","source_order_id","stock_applied") VALUES(p_owner,v->>'id',v_sort,v->>'productId',v->>'productName',v->>'customer',v->>'channel',nullif(v->>'quantity','')::integer,nullif(v->>'price','')::numeric,nullif(v->>'cost','')::numeric,nullif(v->>'fee','')::numeric,nullif(v->>'packaging','')::numeric,nullif(v->>'shipping','')::numeric,nullif(v->>'date','')::date,v->>'status',nullif(v->>'sourceOrderId','')::text,nullif(v->>'stockApplied','')::boolean) ON CONFLICT(owner_id,id) DO UPDATE SET "sort_order"=excluded."sort_order","product_id"=excluded."product_id","product_name"=excluded."product_name","customer"=excluded."customer","channel"=excluded."channel","quantity"=excluded."quantity","price"=excluded."price","cost"=excluded."cost","fee"=excluded."fee","packaging"=excluded."packaging","shipping"=excluded."shipping","ordered_on"=excluded."ordered_on","status"=excluded."status","source_order_id"=excluded."source_order_id","stock_applied"=excluded."stock_applied"; 
WHEN 'expenses' THEN INSERT INTO seller_expenses(owner_id,"id","sort_order","title","category","amount","spent_on","channel","notes") VALUES(p_owner,v->>'id',v_sort,v->>'title',v->>'category',nullif(v->>'amount','')::numeric,nullif(v->>'date','')::date,v->>'channel',v->>'notes') ON CONFLICT(owner_id,id) DO UPDATE SET "sort_order"=excluded."sort_order","title"=excluded."title","category"=excluded."category","amount"=excluded."amount","spent_on"=excluded."spent_on","channel"=excluded."channel","notes"=excluded."notes"; 
WHEN 'refundRecords' THEN INSERT INTO seller_customer_refunds(owner_id,"id","sort_order","order_id","amount","refunded_on","reason") VALUES(p_owner,v->>'id',v_sort,v->>'orderId',nullif(v->>'amount','')::numeric,nullif(v->>'date','')::date,v->>'reason') ON CONFLICT(owner_id,id) DO UPDATE SET "sort_order"=excluded."sort_order","order_id"=excluded."order_id","amount"=excluded."amount","refunded_on"=excluded."refunded_on","reason"=excluded."reason"; 
WHEN 'purchaseOrders' THEN INSERT INTO seller_purchase_orders(owner_id,"id","sort_order","reference","supplier_snapshot_id","supplier_name","created_at","expected_on","notes","status","received_at","cancelled_at","supplier_id") VALUES(p_owner,v->>'id',v_sort,v->>'reference',v->>'supplierId',v->>'supplierName',nullif(v->>'createdAt','')::timestamptz,nullif(v->>'expectedDate','')::date,v->>'notes',v->>'status',nullif(v->>'receivedAt','')::timestamptz,nullif(v->>'cancelledAt','')::timestamptz,(select id from seller_suppliers where owner_id=p_owner and id=v->>'supplierId')) ON CONFLICT(owner_id,id) DO UPDATE SET "sort_order"=excluded."sort_order","reference"=excluded."reference","supplier_snapshot_id"=excluded."supplier_snapshot_id","supplier_name"=excluded."supplier_name","created_at"=excluded."created_at","expected_on"=excluded."expected_on","notes"=excluded."notes","status"=excluded."status","received_at"=excluded."received_at","cancelled_at"=excluded."cancelled_at","supplier_id"=excluded."supplier_id"; DELETE FROM seller_purchase_items WHERE owner_id=p_owner AND purchase_id=v->>'id' AND NOT("product_id"=ANY(ARRAY(SELECT value->>'productId' FROM jsonb_array_elements(coalesce(v->'items','[]'::jsonb)))));
 INSERT INTO seller_purchase_items(owner_id,purchase_id,position,"product_id","product_name","sku","quantity","unit_cost","received_quantity") SELECT p_owner,v->>'id',c.ordinality::int-1,c.value->>'productId',c.value->>'productName',c.value->>'sku',nullif(c.value->>'quantity','')::integer,nullif(c.value->>'unitCost','')::numeric,nullif(c.value->>'receivedQuantity','')::integer FROM jsonb_array_elements(coalesce(v->'items','[]'::jsonb)) WITH ORDINALITY c ON CONFLICT(owner_id,purchase_id,"product_id") DO UPDATE SET position=excluded.position,"product_name"=excluded."product_name","sku"=excluded."sku","quantity"=excluded."quantity","unit_cost"=excluded."unit_cost","received_quantity"=excluded."received_quantity" WHERE (seller_purchase_items.position,seller_purchase_items."product_name",seller_purchase_items."sku",seller_purchase_items."quantity",seller_purchase_items."unit_cost",seller_purchase_items."received_quantity") IS DISTINCT FROM (excluded.position,excluded."product_name",excluded."sku",excluded."quantity",excluded."unit_cost",excluded."received_quantity");
DELETE FROM seller_purchase_payments WHERE owner_id=p_owner AND purchase_id=v->>'id' AND NOT("id"=ANY(ARRAY(SELECT value->>'id' FROM jsonb_array_elements(coalesce(v->'payments','[]'::jsonb)))));
 INSERT INTO seller_purchase_payments(owner_id,purchase_id,position,"id","amount","recorded_on","method","reference","notes") SELECT p_owner,v->>'id',c.ordinality::int-1,c.value->>'id',nullif(c.value->>'amount','')::numeric,nullif(c.value->>'date','')::date,c.value->>'method',c.value->>'reference',c.value->>'notes' FROM jsonb_array_elements(coalesce(v->'payments','[]'::jsonb)) WITH ORDINALITY c ON CONFLICT(owner_id,purchase_id,"id") DO UPDATE SET position=excluded.position,"amount"=excluded."amount","recorded_on"=excluded."recorded_on","method"=excluded."method","reference"=excluded."reference","notes"=excluded."notes" WHERE (seller_purchase_payments.position,seller_purchase_payments."amount",seller_purchase_payments."recorded_on",seller_purchase_payments."method",seller_purchase_payments."reference",seller_purchase_payments."notes") IS DISTINCT FROM (excluded.position,excluded."amount",excluded."recorded_on",excluded."method",excluded."reference",excluded."notes");
DELETE FROM seller_supplier_refunds WHERE owner_id=p_owner AND purchase_id=v->>'id' AND NOT("id"=ANY(ARRAY(SELECT value->>'id' FROM jsonb_array_elements(coalesce(v->'supplierRefunds','[]'::jsonb)))));
 INSERT INTO seller_supplier_refunds(owner_id,purchase_id,position,"id","amount","recorded_on","method","reference","notes") SELECT p_owner,v->>'id',c.ordinality::int-1,c.value->>'id',nullif(c.value->>'amount','')::numeric,nullif(c.value->>'date','')::date,c.value->>'method',c.value->>'reference',c.value->>'notes' FROM jsonb_array_elements(coalesce(v->'supplierRefunds','[]'::jsonb)) WITH ORDINALITY c ON CONFLICT(owner_id,purchase_id,"id") DO UPDATE SET position=excluded.position,"amount"=excluded."amount","recorded_on"=excluded."recorded_on","method"=excluded."method","reference"=excluded."reference","notes"=excluded."notes" WHERE (seller_supplier_refunds.position,seller_supplier_refunds."amount",seller_supplier_refunds."recorded_on",seller_supplier_refunds."method",seller_supplier_refunds."reference",seller_supplier_refunds."notes") IS DISTINCT FROM (excluded.position,excluded."amount",excluded."recorded_on",excluded."method",excluded."reference",excluded."notes");
WHEN 'stockAdjustments' THEN INSERT INTO seller_stock_adjustments(owner_id,"id","sort_order","product_id","product_name","sku","kind","before","after","reason","created_at","purchase_id") VALUES(p_owner,v->>'id',v_sort,v->>'productId',v->>'productName',v->>'sku',v->>'kind',nullif(v->>'before','')::integer,nullif(v->>'after','')::integer,v->>'reason',nullif(v->>'createdAt','')::timestamptz,(select min(id) from seller_purchase_orders where owner_id=p_owner and 'Received '||reference=v->>'reason' having count(*)=1)) ON CONFLICT(owner_id,id) DO UPDATE SET "sort_order"=excluded."sort_order","product_id"=excluded."product_id","product_name"=excluded."product_name","sku"=excluded."sku","kind"=excluded."kind","before"=excluded."before","after"=excluded."after","reason"=excluded."reason","created_at"=excluded."created_at","purchase_id"=excluded."purchase_id";  END CASE;
  END LOOP;
  IF ch ? 'order' THEN EXECUTE format('UPDATE %I t SET sort_order=r.n-1 FROM jsonb_array_elements_text($2) WITH ORDINALITY r(id,n) WHERE t.owner_id=$1 AND t.id=r.id AND t.sort_order<>r.n-1',tab) USING p_owner,ch->'order'; END IF;
 END LOOP;
 UPDATE seller_notebooks n SET display_name=p_name,sidebar_note=CASE WHEN p_changes ? 'sidebarNote' THEN p_changes->>'sidebarNote' ELSE n.sidebar_note END,
 business_name=CASE WHEN p_changes ? 'branding' THEN p_changes->'branding'->>'businessName' ELSE n.business_name END,notebook_title=CASE WHEN p_changes ? 'branding' THEN p_changes->'branding'->>'notebookTitle' ELSE n.notebook_title END,tagline=CASE WHEN p_changes ? 'branding' THEN p_changes->'branding'->>'tagline' ELSE n.tagline END,icon=CASE WHEN p_changes ? 'branding' THEN p_changes->'branding'->>'icon' ELSE n.icon END,revision=p_revision+1,updated_at=clock_timestamp() WHERE n.owner_id=p_owner;
 RETURN QUERY SELECT n.revision,n.updated_at,pg_current_xact_id()::text FROM seller_notebooks n WHERE n.owner_id=p_owner;
END $$;
--> statement-breakpoint
DO $$ DECLARE n record; changes jsonb; before_data jsonb; after_data jsonb; key text; BEGIN
 FOR n IN SELECT owner_id,display_name,revision,document,updated_at FROM seller_notebooks FOR UPDATE LOOP
  changes=jsonb_build_object('sidebarNote',coalesce(n.document->'sidebarNote','""'::jsonb),'branding',coalesce(n.document->'branding','null'::jsonb));
  FOREACH key IN ARRAY ARRAY['products','suppliers','orders','expenses','refundRecords','purchaseOrders','stockAdjustments'] LOOP changes=changes||jsonb_build_object(key,jsonb_build_object('remove','[]'::jsonb,'upsert',coalesce((select jsonb_agg(jsonb_build_object('index',ordinality-1,'record',value) order by ordinality) from jsonb_array_elements(coalesce(n.document->key,'[]'::jsonb)) WITH ORDINALITY),'[]'::jsonb))); END LOOP;
  PERFORM seller_commit_changes(n.owner_id,n.revision,n.display_name,changes);
  UPDATE seller_notebooks SET revision=n.revision,updated_at=n.updated_at WHERE owner_id=n.owner_id;
  after_data=seller_notebook_snapshot(n.owner_id);
  FOREACH key IN ARRAY ARRAY['products','orders','expenses','suppliers','purchaseOrders','stockAdjustments','refundRecords'] LOOP
   IF jsonb_array_length(coalesce(n.document->key,'[]'::jsonb))<>jsonb_array_length(after_data->key) THEN RAISE EXCEPTION 'Migration count mismatch for %',key; END IF;
  END LOOP;
 END LOOP;
END $$;
ALTER TABLE seller_attachments ADD CONSTRAINT seller_attachments_product_fk FOREIGN KEY(owner_id,product_id) REFERENCES seller_products(owner_id,id) ON DELETE SET NULL (product_id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE seller_notebooks DROP COLUMN document;
