const fs = require("node:fs"),
    { specs, children } = require("./relational-spec.cjs");
const file = "db/migrations/0004_relational_notebooks.sql",
    marker = "-- RELATIONAL RUNTIME AND DATA CONVERSION",
    q = (name) => '"' + name + '"',
    cast = (f) => `nullif(v->>'${f.api}','')::${f.type}`,
    read = (f) =>
        f.type === "timestamptz"
            ? `to_char(t.${q(f.column)} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`
            : f.type === "date"
              ? f.api === "expectedDate"
                  ? `coalesce(t.${q(f.column)}::text,'')`
                  : `t.${q(f.column)}::text`
              : `t.${q(f.column)}`;
const sql = [];
const add = (text) => sql.push(text);
add(`-- Preserve owner IDs when nullable composite relationships are cleared.
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
`);
for (const spec of [...children, ...specs]) {
    const fields = [
        ...(specs.includes(spec) ? [`'id',t.id`] : []),
        ...spec.fields.map((f) => `'${f.api}',${read(f)}`),
        ...(spec.nested ? [spec.nested] : []),
    ];
    add(
        `CREATE VIEW ${spec.view} AS SELECT t.*,t.${specs.includes(spec) ? "sort_order" : "position"} AS ordinality,jsonb_strip_nulls(jsonb_build_object(${fields.join(",")})) AS value FROM ${spec.table} t;`,
    );
}
add(
    `CREATE FUNCTION seller_notebook_snapshot(p_owner text) RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('sidebarNote',coalesce((select sidebar_note from seller_notebooks where owner_id=p_owner),''),'branding',(select case when business_name is null then null else jsonb_build_object('businessName',business_name,'notebookTitle',notebook_title,'tagline',tagline,'icon',icon) end from seller_notebooks where owner_id=p_owner),${specs.map((spec) => `'${spec.key}',coalesce((select jsonb_agg(value order by ordinality) from ${spec.view} where owner_id=p_owner),'[]'::jsonb)`).join(",")}) $$;`,
);
// A row projector is used only for payloads. Paged readers query the relational views directly.
const upserts = [];
for (const spec of specs) {
    const cols = ["id", "sort_order", ...spec.fields.map((f) => f.column)],
        values = [`v->>'id'`, "v_sort", ...spec.fields.map(cast)];
    if (spec.key === "purchaseOrders") {
        cols.push("supplier_id");
        values.push(
            `(select id from seller_suppliers where owner_id=p_owner and id=v->>'supplierId')`,
        );
    }
    if (spec.key === "stockAdjustments") {
        cols.push("purchase_id");
        values.push(
            `(select min(id) from seller_purchase_orders where owner_id=p_owner and 'Received '||reference=v->>'reason' having count(*)=1)`,
        );
    }
    let nested = "";
    if (spec.key === "suppliers")
        nested = `
 DELETE FROM seller_supplier_products WHERE owner_id=p_owner AND supplier_id=v->>'id' AND NOT(product_id=ANY(ARRAY(SELECT jsonb_array_elements_text(v->'productIds'))));
 INSERT INTO seller_supplier_products(owner_id,supplier_id,product_id,position) SELECT p_owner,v->>'id',value,ordinality::int-1 FROM jsonb_array_elements_text(v->'productIds') WITH ORDINALITY ON CONFLICT(owner_id,supplier_id,product_id) DO UPDATE SET position=excluded.position WHERE seller_supplier_products.position<>excluded.position;`;
    if (spec.key === "purchaseOrders")
        nested = children
            .map((child) => {
                const columns = child.fields.map((f) => f.column),
                    expressions = child.fields.map(
                        (f) => `nullif(c.value->>'${f.api}','')::${f.type}`,
                    );
                // Empty required text must remain empty, rather than become SQL NULL.
                child.fields.forEach((f, index) => {
                    if (f.type === "text" && !f.optional)
                        expressions[index] = `c.value->>'${f.api}'`;
                });
                return `DELETE FROM ${child.table} WHERE owner_id=p_owner AND purchase_id=v->>'id' AND NOT(${q(child.identity)}=ANY(ARRAY(SELECT value->>'${child.identity === "id" ? "id" : "productId"}' FROM jsonb_array_elements(coalesce(v->'${child.key}','[]'::jsonb)))));
 INSERT INTO ${child.table}(owner_id,purchase_id,position,${columns.map(q).join(",")}) SELECT p_owner,v->>'id',c.ordinality::int-1,${expressions.join(",")} FROM jsonb_array_elements(coalesce(v->'${child.key}','[]'::jsonb)) WITH ORDINALITY c ON CONFLICT(owner_id,purchase_id,${q(child.identity)}) DO UPDATE SET position=excluded.position,${columns
     .filter((name) => name !== child.identity)
     .map((name) => `${q(name)}=excluded.${q(name)}`)
     .join(",")} WHERE (${child.table}.position,${columns
     .filter((name) => name !== child.identity)
     .map((name) => `${child.table}.${q(name)}`)
     .join(",")}) IS DISTINCT FROM (excluded.position,${columns
     .filter((name) => name !== child.identity)
     .map((name) => `excluded.${q(name)}`)
     .join(",")});`;
            })
            .join("\n");
    spec.fields.forEach((f, index) => {
        if (f.type === "text" && !f.optional) values[index + 2] = `v->>'${f.api}'`;
    });
    upserts.push(
        `WHEN '${spec.key}' THEN INSERT INTO ${spec.table}(owner_id,${cols.map(q).join(",")}) VALUES(p_owner,${values.join(",")}) ON CONFLICT(owner_id,id) DO UPDATE SET ${cols
            .filter((name) => name !== "id")
            .map((name) => `${q(name)}=excluded.${q(name)}`)
            .join(",")}; ${nested}`,
    );
}
add(`CREATE FUNCTION seller_commit_changes(p_owner text,p_revision integer,p_name text,p_changes jsonb) RETURNS TABLE(revision integer,"updatedAt" timestamptz,txid text) LANGUAGE plpgsql AS $$
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
 IF jsonb_typeof(p_changes)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_changes) x WHERE x NOT IN ('sidebarNote','branding',${specs.map((s) => `'${s.key}'`).join(",")})) THEN RAISE EXCEPTION 'Invalid record changes'; END IF;
 FOREACH k IN ARRAY ARRAY[${specs.map((s) => `'${s.key}'`).join(",")}] LOOP
  IF NOT(p_changes ? k) THEN CONTINUE; END IF;
  tab=CASE k ${specs.map((s) => `WHEN '${s.key}' THEN '${s.table}'`).join(" ")} END; ch=p_changes->k;
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
   CASE k ${upserts.join("\n")} END CASE;
  END LOOP;
  IF ch ? 'order' THEN EXECUTE format('UPDATE %I t SET sort_order=r.n-1 FROM jsonb_array_elements_text($2) WITH ORDINALITY r(id,n) WHERE t.owner_id=$1 AND t.id=r.id AND t.sort_order<>r.n-1',tab) USING p_owner,ch->'order'; END IF;
 END LOOP;
 UPDATE seller_notebooks n SET display_name=p_name,sidebar_note=CASE WHEN p_changes ? 'sidebarNote' THEN p_changes->>'sidebarNote' ELSE n.sidebar_note END,
 business_name=CASE WHEN p_changes ? 'branding' THEN p_changes->'branding'->>'businessName' ELSE n.business_name END,notebook_title=CASE WHEN p_changes ? 'branding' THEN p_changes->'branding'->>'notebookTitle' ELSE n.notebook_title END,tagline=CASE WHEN p_changes ? 'branding' THEN p_changes->'branding'->>'tagline' ELSE n.tagline END,icon=CASE WHEN p_changes ? 'branding' THEN p_changes->'branding'->>'icon' ELSE n.icon END,revision=p_revision+1,updated_at=clock_timestamp() WHERE n.owner_id=p_owner;
 RETURN QUERY SELECT n.revision,n.updated_at,pg_current_xact_id()::text FROM seller_notebooks n WHERE n.owner_id=p_owner;
END $$;`);
// One-time conversion uses the old document only inside this migration transaction.
add(`DO $$ DECLARE n record; changes jsonb; before_data jsonb; after_data jsonb; key text; BEGIN
 FOR n IN SELECT owner_id,display_name,revision,document,updated_at FROM seller_notebooks FOR UPDATE LOOP
  changes=jsonb_build_object('sidebarNote',coalesce(n.document->'sidebarNote','""'::jsonb),'branding',coalesce(n.document->'branding','null'::jsonb));
  FOREACH key IN ARRAY ARRAY[${specs.map((s) => `'${s.key}'`).join(",")}] LOOP changes=changes||jsonb_build_object(key,jsonb_build_object('remove','[]'::jsonb,'upsert',coalesce((select jsonb_agg(jsonb_build_object('index',ordinality-1,'record',value) order by ordinality) from jsonb_array_elements(coalesce(n.document->key,'[]'::jsonb)) WITH ORDINALITY),'[]'::jsonb))); END LOOP;
  PERFORM seller_commit_changes(n.owner_id,n.revision,n.display_name,changes);
  UPDATE seller_notebooks SET revision=n.revision,updated_at=n.updated_at WHERE owner_id=n.owner_id;
  after_data=seller_notebook_snapshot(n.owner_id);
  FOREACH key IN ARRAY ARRAY['products','orders','expenses','suppliers','purchaseOrders','stockAdjustments','refundRecords'] LOOP
   IF jsonb_array_length(coalesce(n.document->key,'[]'::jsonb))<>jsonb_array_length(after_data->key) THEN RAISE EXCEPTION 'Migration count mismatch for %',key; END IF;
  END LOOP;
 END LOOP;
END $$;
ALTER TABLE seller_attachments ADD CONSTRAINT seller_attachments_product_fk FOREIGN KEY(owner_id,product_id) REFERENCES seller_products(owner_id,id) ON DELETE SET NULL (product_id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE seller_notebooks DROP COLUMN document;`);
let ddl = fs.readFileSync(file, "utf8").split(marker)[0].trimEnd();
fs.writeFileSync(
    file,
    ddl +
        "\n--> statement-breakpoint\n" +
        marker +
        "\n" +
        sql.join("\n--> statement-breakpoint\n") +
        "\n",
);
console.log(
    "Appended relational projections, transactional row writer, data conversion and final document-column removal.",
);
