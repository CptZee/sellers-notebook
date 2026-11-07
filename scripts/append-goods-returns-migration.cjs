const fs = require("node:fs"),
    file = "db/migrations/0007_physical_supplier_returns.sql",
    marker = "-- PHYSICAL GOODS RETURN RUNTIME",
    original = fs.readFileSync("db/migrations/0004_relational_notebooks.sql", "utf8");
const statements = [];
statements.push(
    `DO $$ DECLARE c record; BEGIN FOR c IN SELECT conrelid::regclass tab,conname FROM pg_constraint WHERE contype='f' AND conrelid IN ('seller_purchase_goods_returns'::regclass,'seller_purchase_goods_return_items'::regclass,'seller_goods_return_refunds'::regclass) LOOP EXECUTE format('ALTER TABLE %s ALTER CONSTRAINT %I DEFERRABLE INITIALLY DEFERRED',c.tab,c.conname); END LOOP; END $$;`,
);
statements.push(`CREATE VIEW seller_goods_return_item_records AS SELECT t.*,position AS ordinality,jsonb_strip_nulls(jsonb_build_object('productId',product_id,'productName',product_name,'sku',sku,'quantity',quantity,'unitCost',unit_cost,'stockAdjustmentId',stock_adjustment_id,'voidAdjustmentId',void_adjustment_id)) value FROM seller_purchase_goods_return_items t;
CREATE VIEW seller_goods_return_records AS SELECT t.*,position AS ordinality,jsonb_strip_nulls(jsonb_build_object('id',id,'date',returned_on::text,'reason',reason,'createdAt',to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'voidedAt',to_char(voided_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'items',coalesce((select jsonb_agg(value order by ordinality) from seller_goods_return_item_records i where i.owner_id=t.owner_id and i.purchase_id=t.purchase_id and i.return_id=t.id),'[]'::jsonb))) value FROM seller_purchase_goods_returns t;
CREATE VIEW seller_goods_return_refund_records AS SELECT t.*,position AS ordinality,jsonb_build_object('id',id,'amount',amount,'date',recorded_on::text,'method',method,'reference',reference,'notes',notes) value FROM seller_goods_return_refunds t;`);
let view = original
    .split(/\r?\n/)
    .find((s) => s.startsWith("CREATE VIEW seller_purchase_records AS"));
if (!view) throw Error("Purchase view definition missing.");
view = view
    .replace("CREATE VIEW", "CREATE OR REPLACE VIEW")
    .replace(
        ")) AS value FROM seller_purchase_orders t;",
        ",'goodsReturns',(select jsonb_agg(value order by ordinality) from seller_goods_return_records r where r.owner_id=t.owner_id and r.purchase_id=t.id),'goodsReturnRefunds',(select jsonb_agg(value order by ordinality) from seller_goods_return_refund_records r where r.owner_id=t.owner_id and r.purchase_id=t.id))) AS value FROM seller_purchase_orders t;",
    );
statements.push(view);
let writer = original.slice(original.indexOf("CREATE FUNCTION seller_commit_changes("));
writer = writer
    .slice(0, writer.indexOf("END $$;") + 8)
    .replace("CREATE FUNCTION", "CREATE OR REPLACE FUNCTION")
    .replace("DECLARE actual integer;", "DECLARE return_row jsonb; actual integer;");
const nested = `
 DELETE FROM seller_purchase_goods_returns WHERE owner_id=p_owner AND purchase_id=v->>'id' AND NOT(id=ANY(ARRAY(SELECT value->>'id' FROM jsonb_array_elements(coalesce(v->'goodsReturns','[]'::jsonb)))));
 INSERT INTO seller_purchase_goods_returns(owner_id,purchase_id,id,position,returned_on,reason,created_at,voided_at) SELECT p_owner,v->>'id',c.value->>'id',c.ordinality-1,(c.value->>'date')::date,c.value->>'reason',(c.value->>'createdAt')::timestamptz,(c.value->>'voidedAt')::timestamptz FROM jsonb_array_elements(coalesce(v->'goodsReturns','[]'::jsonb)) WITH ORDINALITY c ON CONFLICT(owner_id,purchase_id,id) DO UPDATE SET position=excluded.position,returned_on=excluded.returned_on,reason=excluded.reason,created_at=excluded.created_at,voided_at=excluded.voided_at;
 FOR return_row IN SELECT value FROM jsonb_array_elements(coalesce(v->'goodsReturns','[]'::jsonb)) LOOP
  DELETE FROM seller_purchase_goods_return_items WHERE owner_id=p_owner AND purchase_id=v->>'id' AND return_id=return_row->>'id' AND NOT(product_id=ANY(ARRAY(SELECT value->>'productId' FROM jsonb_array_elements(return_row->'items'))));
  INSERT INTO seller_purchase_goods_return_items(owner_id,purchase_id,return_id,product_id,position,product_name,sku,quantity,unit_cost,stock_adjustment_id,void_adjustment_id) SELECT p_owner,v->>'id',return_row->>'id',c.value->>'productId',c.ordinality-1,c.value->>'productName',c.value->>'sku',(c.value->>'quantity')::int,(c.value->>'unitCost')::numeric,c.value->>'stockAdjustmentId',c.value->>'voidAdjustmentId' FROM jsonb_array_elements(return_row->'items') WITH ORDINALITY c ON CONFLICT(owner_id,purchase_id,return_id,product_id) DO UPDATE SET position=excluded.position,product_name=excluded.product_name,sku=excluded.sku,quantity=excluded.quantity,unit_cost=excluded.unit_cost,stock_adjustment_id=excluded.stock_adjustment_id,void_adjustment_id=excluded.void_adjustment_id;
 END LOOP;
 DELETE FROM seller_goods_return_refunds WHERE owner_id=p_owner AND purchase_id=v->>'id' AND NOT(id=ANY(ARRAY(SELECT value->>'id' FROM jsonb_array_elements(coalesce(v->'goodsReturnRefunds','[]'::jsonb)))));
 INSERT INTO seller_goods_return_refunds(owner_id,purchase_id,id,position,amount,recorded_on,method,reference,notes) SELECT p_owner,v->>'id',c.value->>'id',c.ordinality-1,(c.value->>'amount')::numeric,(c.value->>'date')::date,c.value->>'method',c.value->>'reference',c.value->>'notes' FROM jsonb_array_elements(coalesce(v->'goodsReturnRefunds','[]'::jsonb)) WITH ORDINALITY c ON CONFLICT(owner_id,purchase_id,id) DO UPDATE SET position=excluded.position,amount=excluded.amount,recorded_on=excluded.recorded_on,method=excluded.method,reference=excluded.reference,notes=excluded.notes;
`;
if (!writer.includes("WHEN 'stockAdjustments'")) throw Error("Transactional writer missing.");
writer = writer.replace(
    "WHEN 'stockAdjustments' THEN INSERT",
    nested + "WHEN 'stockAdjustments' THEN INSERT",
);
statements.push(writer);
fs.writeFileSync(
    file,
    fs.readFileSync(file, "utf8").split(marker)[0].trimEnd() +
        "\n--> statement-breakpoint\n" +
        marker +
        "\n" +
        statements.join("\n--> statement-breakpoint\n") +
        "\n",
);
console.log("Appended typed return projections and transactional nested-row writes.");
