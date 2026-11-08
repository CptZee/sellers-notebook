const fs = require("node:fs");
const { parseEnv } = require("node:util");
const { assertTestDatabaseTarget } = require("./migration-target.cjs");
const { Pool, neonConfig } = require("@neondatabase/serverless");
const { readMigrationFiles } = require("drizzle-orm/migrator");
neonConfig.webSocketConstructor = WebSocket;
const storageTest = process.argv.includes("--storage-test-branch"),
    apiTest = process.argv.includes("--api-test-branch"),
    test = process.argv.includes("--test-branch") || storageTest || apiTest;
if (test) {
    const content = fs.readFileSync(
        apiTest ? ".env.api-test" : storageTest ? ".env.storage-test" : ".env.migration-test",
        "utf8",
    );
    const target = parseEnv(content).DATABASE_URL_UNPOOLED;
    if (!target) throw Error("The test environment is missing DATABASE_URL_UNPOOLED.");
    const productionConnections = [process.env.DATABASE_URL, process.env.DATABASE_URL_UNPOOLED];
    for (const file of [".env", ".env.local", ".env.production", ".env.production.local"]) {
        if (!fs.existsSync(file)) continue;
        const env = parseEnv(fs.readFileSync(file, "utf8"));
        productionConnections.push(env.DATABASE_URL, env.DATABASE_URL_UNPOOLED);
    }
    assertTestDatabaseTarget(target, productionConnections);
    process.env.DATABASE_URL_UNPOOLED = target;
} else require("@next/env").loadEnvConfig(process.cwd());
const pool = new Pool({
    connectionString: process.env.DATABASE_URL_UNPOOLED,
    connectionTimeoutMillis: 10000,
});
pool.on("error", () => console.error("Database connection interrupted."));
const normalize = (value) =>
    Array.isArray(value)
        ? value.map(normalize)
        : value && typeof value === "object"
          ? Object.fromEntries(
                Object.entries(value).map(([key, item]) => [
                    key,
                    ["createdAt", "receivedAt", "cancelledAt"].includes(key)
                        ? new Date(item).toISOString()
                        : normalize(item),
                ]),
            )
          : value;
(async () => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(hashtext('seller-schema-migration'))");
        await client.query("CREATE SCHEMA IF NOT EXISTS drizzle");
        await client.query(
            "CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations(id serial PRIMARY KEY,hash text NOT NULL,created_at bigint)",
        );
        const latest = await client.query(
            "SELECT created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1",
        );
        const last = Number(latest.rows[0]?.created_at ?? 0);
        const oldColumn = await client.query(
            "select 1 from information_schema.columns where table_schema='public' and table_name='seller_notebooks' and column_name='document'",
        );
        // Hold the source rows until the conversion and reconciliation both commit.
        const before = oldColumn.rowCount
            ? (
                  await client.query(
                      "select owner_id,revision,updated_at,document from seller_notebooks for update",
                  )
              ).rows
            : [];
        for (const migration of readMigrationFiles({ migrationsFolder: "db/migrations" })) {
            if (migration.folderMillis <= last) continue;
            for (let index = 0; index < migration.sql.length; index++) {
                try {
                    await client.query(migration.sql[index]);
                } catch (error) {
                    console.error(
                        "Migration failed at statement",
                        index + 1,
                        "SQLSTATE",
                        error.code,
                        "message:",
                        error.message,
                    );
                    throw Error("Migration rolled back.");
                }
            }
            await client.query(
                "INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES($1,$2)",
                [migration.hash, migration.folderMillis],
            );
            console.log("Applied migration", migration.folderMillis);
        }
        const { normalizeBackupDocument } = await import("../lib/notebook-backup.mjs");
        for (const original of before) {
            const converted = (
                await client.query(
                    "select revision,updated_at,seller_notebook_snapshot(owner_id) document from seller_notebooks where owner_id=$1",
                    [original.owner_id],
                )
            ).rows[0];
            const expected = normalizeBackupDocument(original.document);
            expected.purchaseOrders = expected.purchaseOrders.map((p) => ({
                ...p,
                payments: p.payments || [],
                supplierRefunds: p.supplierRefunds || [],
            }));
            require("node:assert/strict").ok(
                require("node:util").isDeepStrictEqual(
                    normalize(converted.document),
                    normalize(expected),
                ),
                "Relational migration must preserve every field and collection order.",
            );
            require("node:assert/strict").equal(converted.revision, original.revision);
            require("node:assert/strict").equal(
                converted.updated_at.toISOString(),
                original.updated_at.toISOString(),
            );
        }
        await client.query("SET CONSTRAINTS ALL IMMEDIATE");
        await client.query("COMMIT");
        if (before.length)
            console.log(
                "Reconciled every field, collection order, revision and timestamp for",
                before.length,
                "notebook(s).",
            );
        const counts = await client.query(
            "select (select count(*)::int from seller_notebooks) notebooks,(select count(*)::int from seller_products) products,(select count(*)::int from seller_orders) orders,(select count(*)::int from seller_expenses) expenses,(select count(*)::int from seller_purchase_orders) purchases,exists(select 1 from information_schema.columns where table_schema='public' and table_name='seller_notebooks' and column_name='document') document_column",
        );
        console.log(test ? "Test branch:" : "Current database:", counts.rows[0]);
    } catch (error) {
        await client.query("ROLLBACK");
        console.error(error.message);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
})().catch(async (error) => {
    console.error(
        "Migration connection failed:",
        error.message ||
            "Could not reach the configured database. Check that its branch still exists and its credentials are current.",
    );
    process.exitCode = 1;
    await pool.end().catch(() => {});
});
