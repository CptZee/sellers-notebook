const fs = require("node:fs"),
    assert = require("node:assert/strict");
const { Pool, neonConfig } = require("@neondatabase/serverless");
neonConfig.webSocketConstructor = WebSocket;
const content = fs.readFileSync(".env.migration-test", "utf8");
const pool = new Pool({
    connectionString: content.match(/^DATABASE_URL_UNPOOLED=(.+)$/m)[1].trim(),
});
const normalize = (value) =>
    Array.isArray(value)
        ? value.map(normalize)
        : value && typeof value === "object"
          ? Object.fromEntries(
                Object.entries(value).map(([k, v]) => [
                    k,
                    ["createdAt", "receivedAt", "cancelledAt"].includes(k)
                        ? new Date(v).toISOString()
                        : normalize(v),
                ]),
            )
          : value;
(async () => {
    const c = await pool.connect();
    try {
        const { createSampleNotebook } = await import("../lib/sample-notebook.mjs"),
            { createNotebookPatch } = await import("../lib/notebook-patch.mjs"),
            { normalizeBackupDocument } = await import("../lib/notebook-backup.mjs"),
            { validDocument } = await import("../lib/notebook-validation.mjs");
        const owner = "relational-qa-" + crypto.randomUUID(),
            document = normalizeBackupDocument(createSampleNotebook());
        document.purchaseOrders = document.purchaseOrders.map((p) => ({
            ...p,
            payments: p.payments || [],
            supplierRefunds: p.supplierRefunds || [],
        }));
        assert.equal(validDocument(document), true);
        const save = async (revision, changes) =>
            c.query("select * from seller_commit_changes($1,$2,$3,$4::jsonb)", [
                owner,
                revision,
                "Schema QA",
                JSON.stringify(changes),
            ]);
        await c.query("BEGIN");
        await save(0, createNotebookPatch({}, document));
        await c.query("SET CONSTRAINTS ALL IMMEDIATE");
        await c.query("SET CONSTRAINTS ALL DEFERRED");
        let saved = (await c.query("select seller_notebook_snapshot($1) document", [owner])).rows[0]
            .document;
        assert.deepEqual(normalize(saved), normalize(document));
        console.log(
            "PASS sample round trip: 120 products, 180 orders, 120 expenses, suppliers, purchases and histories",
        );
        await c.query("CREATE TEMP TABLE qa_product_updates(id text) ON COMMIT DROP");
        await c.query(
            "CREATE FUNCTION pg_temp.qa_product_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN INSERT INTO qa_product_updates VALUES(NEW.id); RETURN NEW; END $$",
        );
        await c.query(
            "CREATE TRIGGER qa_product_update AFTER UPDATE ON seller_products FOR EACH ROW EXECUTE FUNCTION pg_temp.qa_product_update()",
        );
        const next = structuredClone(saved);
        next.products[0].name = "Relational edit";
        await save(1, createNotebookPatch(saved, next));
        assert.equal((await save(1, {})).rowCount, 0);
        console.log("PASS stale revision rejected");
        assert.deepEqual((await c.query("select id from qa_product_updates")).rows, [
            { id: document.products[0].id },
        ]);
        console.log("PASS update trigger proves only the changed product row was written");
        await c.query("SAVEPOINT fk");
        await c.query(
            "insert into seller_supplier_products(owner_id,supplier_id,product_id,position) values($1,$2,$3,999)",
            [owner, document.suppliers[0].id, "foreign-product"],
        );
        let rejected = false;
        try {
            await c.query("SET CONSTRAINTS ALL IMMEDIATE");
        } catch (error) {
            assert.equal(error.code, "23503");
            rejected = true;
        }
        assert.equal(rejected, true);
        await c.query("ROLLBACK TO SAVEPOINT fk");
        console.log("PASS owner-scoped foreign keys reject missing or foreign records");
        const p = next.products[0],
            p2 = next.products[1];
        [p.sku, p2.sku] = [p2.sku, p.sku];
        await save(2, createNotebookPatch(saved, next));
        await c.query("SET CONSTRAINTS ALL IMMEDIATE");
        console.log("PASS atomic SKU swaps with deferred uniqueness");
        const supplier = document.suppliers[0],
            purchase = document.purchaseOrders.find((p) => p.supplierId === supplier.id);
        await c.query("delete from seller_suppliers where owner_id=$1 and id=$2", [
            owner,
            supplier.id,
        ]);
        const archived = (
            await c.query(
                "select supplier_id,supplier_snapshot_id,supplier_name from seller_purchase_orders where owner_id=$1 and id=$2",
                [owner, purchase.id],
            )
        ).rows[0];
        assert.equal(archived.supplier_id, null);
        assert.equal(archived.supplier_snapshot_id, supplier.id);
        assert.equal(archived.supplier_name, purchase.supplierName);
        console.log("PASS supplier deletion preserves purchase history and owner");
        await c.query("ROLLBACK");
        console.log("Relational fixture transaction rolled back; copied user data unchanged.");
    } catch (error) {
        await c.query("ROLLBACK");
        console.error(error.code || "", error.message.slice(0, 1600));
        process.exitCode = 1;
    } finally {
        c.release();
        await pool.end();
    }
})();
