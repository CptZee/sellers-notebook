const fs = require("node:fs"),
    assert = require("node:assert/strict");
require("@next/env").loadEnvConfig(process.cwd());
const original = process.env.DATABASE_URL,
    content = fs.readFileSync(".env.migration-test", "utf8"),
    branch = content.match(/^DATABASE_URL=(.+)$/m)[1].trim();
assert.notEqual(
    new URL(branch).hostname.replace("-pooler", "").toLowerCase(),
    new URL(original).hostname.replace("-pooler", "").toLowerCase(),
    "Use an isolated branch, never the current database.",
);
process.env.DATABASE_URL = branch;
require("esbuild").buildSync({
    entryPoints: ["lib/marketplace-sync.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
    outfile: ".next/sync-queue-qa.mjs",
});
(async () => {
    const { neon } = require("@neondatabase/serverless"),
        sql = neon(branch),
        sync = await import("../.next/sync-queue-qa.mjs"),
        owner = "sync-qa-" + crypto.randomUUID(),
        connection = crypto.randomUUID();
    assert.equal(
        (await sql`select count(*)::int count from seller_marketplace_sync_settings`)[0].count,
        0,
        "Use a fresh isolated branch without other sync settings.",
    );
    const before = (await sql`select count(*)::int count from seller_orders`)[0].count;
    const rows = [
        {
            "Order ID": "sync-order",
            "Seller SKU": "MUG",
            Quantity: "2",
            "Unit Price": "12.50",
            "Order Date": "2026-11-05",
            "Order Status": "COMPLETED",
            "Buyer Username": "Marketplace buyer",
            Currency: "PHP",
        },
    ];
    try {
        await sql`insert into seller_marketplace_connections(owner_id,platform,connection_id,account_id,token_ciphertext,app_fingerprint,expires_at) values(${owner},'lazada',${connection},'fixture-shop','fixture-cipher','fixture-app',now()+interval '1 hour')`;
        await sql`insert into seller_marketplace_sync_settings(owner_id,platform,connection_id,enabled,next_run_at) values(${owner},'lazada',${connection},true,now())`;
        await Promise.all([sync.enqueueSync(["lazada"]), sync.enqueueSync(["lazada"])]);
        assert.equal(
            (
                await sql`select count(*)::int count from seller_marketplace_sync_runs where owner_id=${owner}`
            )[0].count,
            1,
        );
        const claimed = await Promise.all([sync.claimSync(["lazada"]), sync.claimSync(["lazada"])]),
            job = claimed.find(Boolean);
        assert.equal(claimed.filter(Boolean).length, 1);
        assert.equal(await sync.stageSync(job, rows), true);
        assert.equal(await sync.stageSync(job, rows), false);
        const [ready] =
            await sql`select status,rows_count from seller_marketplace_sync_runs where owner_id=${owner} and id=${job.id}`;
        assert.equal(ready.status, "ready");
        assert.equal(ready.rows_count, 1);
        console.log(
            "PASS concurrent enqueue/claim creates one leased run; stage is atomic and idempotent",
        );
        await assert.rejects(
            () =>
                sql`insert into seller_marketplace_sync_rows(owner_id,run_id,position,source_order_id,sku,quantity,unit_price,ordered_on,status,buyer,currency) values('foreign-owner',${job.id},0,'x','MUG',1,1,'2026-11-05','COMPLETED','Buyer','PHP')`,
            (e) => e.code === "23503",
        );
        console.log("PASS staged-row foreign keys enforce owner identity");
        async function newJob() {
            await sql`update seller_marketplace_sync_settings set enabled=true,next_run_at=now() where owner_id=${owner}`;
            await sync.enqueueSync(["lazada"]);
            const result = await sync.claimSync(["lazada"]);
            assert.ok(result);
            return result;
        }
        let retry = await newJob();
        for (let attempt = 1; attempt <= 3; attempt++) {
            assert.equal(retry.attempts, attempt);
            await sync.finishSyncFailure(retry, Error("The marketplace request failed."));
            const [r] =
                await sql`select status,available_at>now() waiting from seller_marketplace_sync_runs where owner_id=${owner} and id=${retry.id}`;
            assert.equal(r.status, attempt < 3 ? "retrying" : "failed");
            if (attempt < 3) {
                assert.equal(r.waiting, true);
                assert.equal(await sync.claimSync(["lazada"]), undefined);
                await sql`update seller_marketplace_sync_runs set available_at=now() where owner_id=${owner} and id=${retry.id}`;
                retry = await sync.claimSync(["lazada"]);
            }
        }
        console.log("PASS transient failures back off and stop after three attempts");
        const disabled = await newJob();
        await sql`update seller_marketplace_sync_settings set enabled=false where owner_id=${owner}`;
        assert.equal(await sync.stageSync(disabled, rows), false);
        await sync.finishSyncFailure(disabled, null, true);
        assert.equal(
            (
                await sql`select count(*)::int count from seller_marketplace_sync_rows where owner_id=${owner} and run_id=${disabled.id}`
            )[0].count,
            0,
        );
        console.log("PASS turning off an in-flight schedule prevents publishing its batch");
        const lost = await newJob();
        await sql`delete from seller_marketplace_connections where owner_id=${owner}`;
        assert.equal(await sync.stageSync(lost, rows), false);
        await sync.finishSyncFailure(lost, null, true);
        assert.equal((await sql`select count(*)::int count from seller_orders`)[0].count, before);
        console.log("PASS disconnect prevents publishing and no sync action writes sales");
        await sql`insert into seller_marketplace_connections(owner_id,platform,connection_id,account_id,token_ciphertext,app_fingerprint,expires_at) values(${owner},'lazada',${connection},'fixture-shop','fixture-cipher','fixture-app',now()+interval '1 hour')`;
        await sql`update seller_marketplace_sync_settings set next_run_at=now() where owner_id=${owner}`;
        let fetched = 0;
        await sync.workMarketplaceSync(["lazada"], {
            load: async () => ({
                config: { ready: true, platform: "lazada" },
                connection: { connection_id: connection },
                tokens: {},
            }),
            fetchRows: async (config, tokens, range) => {
                assert.ok(Number.isSafeInteger(range.from));
                assert.ok(range.to >= range.from);
                fetched++;
                return { rows };
            },
        });
        assert.equal(fetched, 1);
        assert.equal(
            (
                await sql`select count(*)::int count from seller_marketplace_sync_runs where owner_id=${owner} and status='ready'`
            )[0].count,
            2,
        );
        assert.equal((await sql`select count(*)::int count from seller_orders`)[0].count, before);
        console.log(
            "PASS worker orchestrates a mocked fetch into typed preview rows without saving sales",
        );
        const settings = { intervalMinutes: 60, lookbackDays: 1, shopCipher: "selected-shop" };
        assert.equal(
            await sync.configureMarketplaceSync(owner, "lazada", settings, "wrong-app"),
            false,
        );
        assert.equal(
            await sync.configureMarketplaceSync(owner, "lazada", settings, "fixture-app"),
            true,
        );
        await sync.enqueueSync(["lazada"]);
        const changing = await sync.claimSync(["lazada"]);
        assert.equal(changing.shop_cipher, "selected-shop");
        assert.equal(
            await sync.configureMarketplaceSync(
                owner,
                "lazada",
                { ...settings, shopCipher: "new-shop" },
                "fixture-app",
            ),
            true,
        );
        assert.equal(await sync.stageSync(changing, rows), false);
        assert.equal(
            (
                await sql`select status from seller_marketplace_sync_runs where owner_id=${owner} and id=${changing.id}`
            )[0].status,
            "cancelled",
        );
        assert.equal(await sync.retryMarketplaceSync(owner, "lazada", changing.id), false);
        const failed = await newJob();
        await sync.finishSyncFailure(failed, Error("Unsupported payload"));
        assert.equal(await sync.retryMarketplaceSync(owner, "lazada", failed.id), true);
        const retried = await sync.claimSync(["lazada"]);
        assert.equal(retried.attempts, 1);
        await sync.disableMarketplaceSync(owner, "lazada");
        assert.equal(await sync.stageSync(retried, rows), false);
        assert.equal(await sync.retryMarketplaceSync(owner, "lazada", failed.id), false);
        console.log(
            "PASS configuration is app-bound; shop changes cancel old work and disabled schedules cannot retry",
        );
        const expired = await newJob();
        await sql`update seller_marketplace_sync_runs set lease_until=now()-interval '1 second' where owner_id=${owner} and id=${expired.id}`;
        const recovered = await sync.claimSync(["lazada"]);
        assert.equal(recovered.attempts, 2);
        assert.notEqual(recovered.lease_token, expired.lease_token);
        assert.equal(await sync.stageSync(expired, rows), false);
        assert.equal(await sync.stageSync(recovered, rows), true);
        let exhausted = await newJob();
        for (let n = 1; n < 3; n++) {
            await sql`update seller_marketplace_sync_runs set lease_until=now()-interval '1 second' where owner_id=${owner} and id=${exhausted.id}`;
            exhausted = await sync.claimSync(["lazada"]);
        }
        await sql`update seller_marketplace_sync_runs set lease_until=now()-interval '1 second' where owner_id=${owner} and id=${exhausted.id}`;
        assert.equal(await sync.claimSync(["lazada"]), undefined);
        assert.equal(
            (
                await sql`select status from seller_marketplace_sync_runs where owner_id=${owner} and id=${exhausted.id}`
            )[0].status,
            "failed",
        );
        console.log(
            "PASS crashed workers recover with a new lease, stale workers cannot publish, and exhausted leases fail",
        );
    } finally {
        await sql`delete from seller_marketplace_sync_settings where owner_id=${owner}`;
        await sql`delete from seller_marketplace_connections where owner_id=${owner}`;
    }
})().catch((error) => {
    console.error("FAIL", error.cause?.message || error.message.split("\n")[0]);
    process.exitCode = 1;
});
