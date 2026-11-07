CREATE TABLE "seller_goods_return_refunds" (
	"owner_id" text NOT NULL,
	"purchase_id" text NOT NULL,
	"id" text NOT NULL,
	"position" integer NOT NULL,
	"amount" numeric NOT NULL,
	"recorded_on" date NOT NULL,
	"method" text NOT NULL,
	"reference" text NOT NULL,
	"notes" text NOT NULL,
	CONSTRAINT "seller_goods_return_refunds_owner_id_purchase_id_id_pk" PRIMARY KEY("owner_id","purchase_id","id"),
	CONSTRAINT "seller_goods_return_refunds_amount" CHECK ("seller_goods_return_refunds"."amount">0 and "seller_goods_return_refunds"."amount"=round("seller_goods_return_refunds"."amount",2))
);

--> statement-breakpoint
CREATE TABLE "seller_purchase_goods_return_items" (
	"owner_id" text NOT NULL,
	"purchase_id" text NOT NULL,
	"return_id" text NOT NULL,
	"product_id" text NOT NULL,
	"position" integer NOT NULL,
	"product_name" text NOT NULL,
	"sku" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_cost" numeric NOT NULL,
	"stock_adjustment_id" text NOT NULL,
	"void_adjustment_id" text,
	CONSTRAINT "seller_purchase_goods_return_items_owner_id_purchase_id_return_id_product_id_pk" PRIMARY KEY("owner_id","purchase_id","return_id","product_id"),
	CONSTRAINT "seller_goods_return_stock_unique" UNIQUE("owner_id","stock_adjustment_id"),
	CONSTRAINT "seller_goods_return_void_unique" UNIQUE("owner_id","void_adjustment_id"),
	CONSTRAINT "seller_goods_return_items_bounds" CHECK ("seller_purchase_goods_return_items"."quantity" between 1 and 10000000 and "seller_purchase_goods_return_items"."unit_cost" between 0 and 100000000 and "seller_purchase_goods_return_items"."unit_cost"=round("seller_purchase_goods_return_items"."unit_cost",2))
);

--> statement-breakpoint
CREATE TABLE "seller_purchase_goods_returns" (
	"owner_id" text NOT NULL,
	"purchase_id" text NOT NULL,
	"id" text NOT NULL,
	"position" integer NOT NULL,
	"returned_on" date NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"voided_at" timestamp with time zone,
	CONSTRAINT "seller_purchase_goods_returns_owner_id_purchase_id_id_pk" PRIMARY KEY("owner_id","purchase_id","id")
);

--> statement-breakpoint
ALTER TABLE "seller_stock_adjustments" DROP CONSTRAINT "seller_stock_adjustments_kind_check";
--> statement-breakpoint
ALTER TABLE "seller_goods_return_refunds" ADD CONSTRAINT "seller_goods_return_refunds_owner_id_seller_notebooks_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."seller_notebooks"("owner_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "seller_goods_return_refunds" ADD CONSTRAINT "seller_goods_return_purchase_fk" FOREIGN KEY ("owner_id","purchase_id") REFERENCES "public"."seller_purchase_orders"("owner_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "seller_purchase_goods_return_items" ADD CONSTRAINT "seller_purchase_goods_return_items_owner_id_seller_notebooks_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."seller_notebooks"("owner_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "seller_purchase_goods_return_items" ADD CONSTRAINT "seller_goods_return_items_header_fk" FOREIGN KEY ("owner_id","purchase_id","return_id") REFERENCES "public"."seller_purchase_goods_returns"("owner_id","purchase_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "seller_purchase_goods_return_items" ADD CONSTRAINT "seller_goods_return_items_purchase_line_fk" FOREIGN KEY ("owner_id","purchase_id","product_id") REFERENCES "public"."seller_purchase_items"("owner_id","purchase_id","product_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "seller_purchase_goods_return_items" ADD CONSTRAINT "seller_goods_return_items_stock_fk" FOREIGN KEY ("owner_id","stock_adjustment_id") REFERENCES "public"."seller_stock_adjustments"("owner_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "seller_purchase_goods_return_items" ADD CONSTRAINT "seller_goods_return_items_void_fk" FOREIGN KEY ("owner_id","void_adjustment_id") REFERENCES "public"."seller_stock_adjustments"("owner_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "seller_purchase_goods_returns" ADD CONSTRAINT "seller_purchase_goods_returns_owner_id_seller_notebooks_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."seller_notebooks"("owner_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "seller_purchase_goods_returns" ADD CONSTRAINT "seller_goods_return_purchase_fk" FOREIGN KEY ("owner_id","purchase_id") REFERENCES "public"."seller_purchase_orders"("owner_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "seller_stock_adjustments" ADD CONSTRAINT "seller_stock_adjustments_kind_check" CHECK ("seller_stock_adjustments"."kind" in ('Restock','Damage','Correction','Supplier return'));
--> statement-breakpoint
--> statement-breakpoint
-- PHYSICAL GOODS RETURN RUNTIME
DO $$ DECLARE c record; BEGIN FOR c IN SELECT conrelid::regclass tab,conname FROM pg_constraint WHERE contype='f' AND conrelid IN ('seller_purchase_goods_returns'::regclass,'seller_purchase_goods_return_items'::regclass,'seller_goods_return_refunds'::regclass) LOOP EXECUTE format('ALTER TABLE %s ALTER CONSTRAINT %I DEFERRABLE INITIALLY DEFERRED',c.tab,c.conname); END LOOP; END $$;
--> statement-breakpoint
CREATE VIEW seller_goods_return_item_records AS SELECT t.*,position AS ordinality,jsonb_strip_nulls(jsonb_build_object('productId',product_id,'productName',product_name,'sku',sku,'quantity',quantity,'unitCost',unit_cost,'stockAdjustmentId',stock_adjustment_id,'voidAdjustmentId',void_adjustment_id)) value FROM seller_purchase_goods_return_items t;
CREATE VIEW seller_goods_return_records AS SELECT t.*,position AS ordinality,jsonb_strip_nulls(jsonb_build_object('id',id,'date',returned_on::text,'reason',reason,'createdAt',to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'voidedAt',to_char(voided_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'items',coalesce((select jsonb_agg(value order by ordinality) from seller_goods_return_item_records i where i.owner_id=t.owner_id and i.purchase_id=t.purchase_id and i.return_id=t.id),'[]'::jsonb))) value FROM seller_purchase_goods_returns t;
CREATE VIEW seller_goods_return_refund_records AS SELECT t.*,position AS ordinality,jsonb_build_object('id',id,'amount',amount,'date',recorded_on::text,'method',method,'reference',reference,'notes',notes) value FROM seller_goods_return_refunds t;
--> statement-breakpoint
CREATE OR REPLACE VIEW seller_purchase_records AS SELECT t.*,t.sort_order AS ordinality,jsonb_strip_nulls(jsonb_build_object('id',t.id,'reference',t."reference",'supplierId',t."supplier_snapshot_id",'supplierName',t."supplier_name",'createdAt',to_char(t."created_at" at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'expectedDate',coalesce(t."expected_on"::text,''),'notes',t."notes",'status',t."status",'receivedAt',to_char(t."received_at" at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'cancelledAt',to_char(t."cancelled_at" at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'items',coalesce((select jsonb_agg(value order by ordinality) from seller_purchase_item_records c where c.owner_id=t.owner_id and c.purchase_id=t.id),'[]'::jsonb),'payments',coalesce((select jsonb_agg(value order by ordinality) from seller_purchase_payment_records c where c.owner_id=t.owner_id and c.purchase_id=t.id),'[]'::jsonb),'supplierRefunds',coalesce((select jsonb_agg(value order by ordinality) from seller_supplier_refund_records c where c.owner_id=t.owner_id and c.purchase_id=t.id),'[]'::jsonb),'goodsReturns',(select jsonb_agg(value order by ordinality) from seller_goods_return_records r where r.owner_id=t.owner_id and r.purchase_id=t.id),'goodsReturnRefunds',(select jsonb_agg(value order by ordinality) from seller_goods_return_refund_records r where r.owner_id=t.owner_id and r.purchase_id=t.id))) AS value FROM seller_purchase_orders t;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION seller_commit_changes(p_owner text,p_revision integer,p_name text,p_changes jsonb) RETURNS TABLE(revision integer,"updatedAt" timestamptz,txid text) LANGUAGE plpgsql AS $$
DECLARE return_row jsonb; actual integer; k text; tab text; ch jsonb; entry jsonb; v jsonb; v_sort numeric; original_ids text[]; target_ids text[]; rid text; idx integer; prev_sort numeric; next_sort numeric;
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

 DELETE FROM seller_purchase_goods_returns WHERE owner_id=p_owner AND purchase_id=v->>'id' AND NOT(id=ANY(ARRAY(SELECT value->>'id' FROM jsonb_array_elements(coalesce(v->'goodsReturns','[]'::jsonb)))));
 INSERT INTO seller_purchase_goods_returns(owner_id,purchase_id,id,position,returned_on,reason,created_at,voided_at) SELECT p_owner,v->>'id',c.value->>'id',c.ordinality-1,(c.value->>'date')::date,c.value->>'reason',(c.value->>'createdAt')::timestamptz,(c.value->>'voidedAt')::timestamptz FROM jsonb_array_elements(coalesce(v->'goodsReturns','[]'::jsonb)) WITH ORDINALITY c ON CONFLICT(owner_id,purchase_id,id) DO UPDATE SET position=excluded.position,returned_on=excluded.returned_on,reason=excluded.reason,created_at=excluded.created_at,voided_at=excluded.voided_at;
 FOR return_row IN SELECT value FROM jsonb_array_elements(coalesce(v->'goodsReturns','[]'::jsonb)) LOOP
  DELETE FROM seller_purchase_goods_return_items WHERE owner_id=p_owner AND purchase_id=v->>'id' AND return_id=return_row->>'id' AND NOT(product_id=ANY(ARRAY(SELECT value->>'productId' FROM jsonb_array_elements(return_row->'items'))));
  INSERT INTO seller_purchase_goods_return_items(owner_id,purchase_id,return_id,product_id,position,product_name,sku,quantity,unit_cost,stock_adjustment_id,void_adjustment_id) SELECT p_owner,v->>'id',return_row->>'id',c.value->>'productId',c.ordinality-1,c.value->>'productName',c.value->>'sku',(c.value->>'quantity')::int,(c.value->>'unitCost')::numeric,c.value->>'stockAdjustmentId',c.value->>'voidAdjustmentId' FROM jsonb_array_elements(return_row->'items') WITH ORDINALITY c ON CONFLICT(owner_id,purchase_id,return_id,product_id) DO UPDATE SET position=excluded.position,product_name=excluded.product_name,sku=excluded.sku,quantity=excluded.quantity,unit_cost=excluded.unit_cost,stock_adjustment_id=excluded.stock_adjustment_id,void_adjustment_id=excluded.void_adjustment_id;
 END LOOP;
 DELETE FROM seller_goods_return_refunds WHERE owner_id=p_owner AND purchase_id=v->>'id' AND NOT(id=ANY(ARRAY(SELECT value->>'id' FROM jsonb_array_elements(coalesce(v->'goodsReturnRefunds','[]'::jsonb)))));
 INSERT INTO seller_goods_return_refunds(owner_id,purchase_id,id,position,amount,recorded_on,method,reference,notes) SELECT p_owner,v->>'id',c.value->>'id',c.ordinality-1,(c.value->>'amount')::numeric,(c.value->>'date')::date,c.value->>'method',c.value->>'reference',c.value->>'notes' FROM jsonb_array_elements(coalesce(v->'goodsReturnRefunds','[]'::jsonb)) WITH ORDINALITY c ON CONFLICT(owner_id,purchase_id,id) DO UPDATE SET position=excluded.position,amount=excluded.amount,recorded_on=excluded.recorded_on,method=excluded.method,reference=excluded.reference,notes=excluded.notes;
WHEN 'stockAdjustments' THEN INSERT INTO seller_stock_adjustments(owner_id,"id","sort_order","product_id","product_name","sku","kind","before","after","reason","created_at","purchase_id") VALUES(p_owner,v->>'id',v_sort,v->>'productId',v->>'productName',v->>'sku',v->>'kind',nullif(v->>'before','')::integer,nullif(v->>'after','')::integer,v->>'reason',nullif(v->>'createdAt','')::timestamptz,(select min(id) from seller_purchase_orders where owner_id=p_owner and 'Received '||reference=v->>'reason' having count(*)=1)) ON CONFLICT(owner_id,id) DO UPDATE SET "sort_order"=excluded."sort_order","product_id"=excluded."product_id","product_name"=excluded."product_name","sku"=excluded."sku","kind"=excluded."kind","before"=excluded."before","after"=excluded."after","reason"=excluded."reason","created_at"=excluded."created_at","purchase_id"=excluded."purchase_id";  END CASE;
  END LOOP;
  IF ch ? 'order' THEN EXECUTE format('UPDATE %I t SET sort_order=r.n-1 FROM jsonb_array_elements_text($2) WITH ORDINALITY r(id,n) WHERE t.owner_id=$1 AND t.id=r.id AND t.sort_order<>r.n-1',tab) USING p_owner,ch->'order'; END IF;
 END LOOP;
 UPDATE seller_notebooks n SET display_name=p_name,sidebar_note=CASE WHEN p_changes ? 'sidebarNote' THEN p_changes->>'sidebarNote' ELSE n.sidebar_note END,
 business_name=CASE WHEN p_changes ? 'branding' THEN p_changes->'branding'->>'businessName' ELSE n.business_name END,notebook_title=CASE WHEN p_changes ? 'branding' THEN p_changes->'branding'->>'notebookTitle' ELSE n.notebook_title END,tagline=CASE WHEN p_changes ? 'branding' THEN p_changes->'branding'->>'tagline' ELSE n.tagline END,icon=CASE WHEN p_changes ? 'branding' THEN p_changes->'branding'->>'icon' ELSE n.icon END,revision=p_revision+1,updated_at=clock_timestamp() WHERE n.owner_id=p_owner;
 RETURN QUERY SELECT n.revision,n.updated_at,pg_current_xact_id()::text FROM seller_notebooks n WHERE n.owner_id=p_owner;
END $$;

