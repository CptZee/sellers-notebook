const { chromium } = require("@playwright/test"),
    assert = require("node:assert/strict"),
    crypto = require("node:crypto"),
    fs = require("node:fs"),
    path = require("node:path");
const { promisify } = require("node:util");
require("@next/env").loadEnvConfig(process.cwd());
const base = "http://127.0.0.1:3000",
    users = [],
    checks = [];
const pass = (name) => {
    checks.push(name);
    console.log("PASS " + name);
};
(async () => {
    let browser, failure;
    try {
        browser = await chromium.launch({ channel: "msedge", headless: true });
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
        async function signup(ctx, prefix) {
            const p = await ctx.newPage();
            await p.goto(base + "/auth/sign-up");
            await p.getByLabel("Your name").fill("Paged suppliers review");
            await p.getByLabel("Email address").fill(`${prefix}-${Date.now()}@example.com`);
            const password = crypto.randomBytes(24).toString("base64url");
            await p.getByLabel("Password", { exact: true }).fill(password);
            await p.getByLabel("Confirm password", { exact: true }).fill(password);
            await p.getByRole("button", { name: "Create account", exact: true }).click();
            await p.waitForURL(base + "/notebook");
            const user = (await (await ctx.request.get(base + "/api/notebook/manifest")).json())
                .user;
            users.push(user.id);
            await p.close();
            return user;
        }
        const user = await signup(context, "notebook-sync-history"),
            { createSampleNotebook } = await import("../lib/sample-notebook.mjs"),
            document = createSampleNotebook();
        let response = await context.request.put(base + "/api/notebook", {
            headers: { Origin: base },
            data: { revision: 0, document },
        });
        assert.equal(response.status(), 200, await response.text());
        let revision = (await response.json()).revision;
        context.setDefaultTimeout(15000);
        const { neon } = require("@neondatabase/serverless"),
            db = neon(process.env.DATABASE_URL),
            connection = crypto.randomUUID(),
            run = crypto.randomUUID(),
            active = crypto.randomUUID();
        await db`insert into seller_marketplace_connections(owner_id,platform,connection_id,account_id,token_ciphertext,app_fingerprint,expires_at) values(${user.id},'lazada',${connection},'fixture-shop','fixture-cipher','fixture-app',now()+interval '1 hour')`;
        await db`insert into seller_marketplace_sync_settings(owner_id,platform,connection_id,enabled) values(${user.id},'lazada',${connection},true)`;
        await db`insert into seller_marketplace_sync_runs(owner_id,id,platform,connection_id,status,attempts,from_date,to_date,rows_count) values(${user.id},${run},'lazada',${connection},'ready',1,'2026-11-05','2026-11-06',1)`;
        await db`insert into seller_marketplace_sync_rows(owner_id,run_id,position,source_order_id,sku,quantity,unit_price,ordered_on,status,buyer,currency) values(${user.id},${run},0,'SCHEDULED-REVIEW-1',${document.products[0].sku},1,10,'2026-11-05','COMPLETED','Marketplace buyer','PHP')`;
        await db`insert into seller_marketplace_sync_runs(owner_id,platform,connection_id,status,attempts,from_date,to_date,created_at,error_message) select ${user.id},'lazada',${connection},'failed',3,'2026-11-05','2026-11-06',now()-n*interval '1 minute','Provider retry limit reached.' from generate_series(1,25) n`;
        const endpoint = base + "/api/marketplaces/lazada/sync",
            history = await context.request.get(endpoint);
        assert.equal(history.status(), 200, await history.text());
        const data = await history.json();
        assert.equal(data.available, false);
        assert.equal(data.total, 26);
        assert.equal(data.runs.length, 25);
        assert.equal(
            (await (await context.request.get(endpoint + "?page=2")).json()).runs.length,
            1,
        );
        const batch = await context.request.get(endpoint + "?run=" + run);
        assert.equal(batch.status(), 200);
        const fetched = await batch.json();
        assert.equal(fetched.rows[0]["Seller SKU"], document.products[0].sku);
        assert.equal(fetched.rows[0]["Unit Price"], "10.00");
        assert.ok(!JSON.stringify(data).includes("fixture-cipher"));
        pass(
            "History is bounded to 25 rows and typed ready batches reconstruct preview rows without token metadata",
        );
        assert.equal(
            (
                await context.request.post(endpoint, {
                    headers: { Origin: base },
                    data: {
                        action: "configure",
                        enabled: true,
                        intervalMinutes: 360,
                        lookbackDays: 2,
                    },
                })
            ).status(),
            503,
        );
        assert.equal(
            (
                await context.request.post(base + "/api/internal/marketplace-sync", {
                    headers: { Authorization: "Bearer wrong" },
                })
            ).status(),
            401,
        );
        const page = await context.newPage(),
            reads = [];
        page.on("request", (r) => {
            if (r.method() === "GET") reads.push(r.url());
        });
        await page.goto(base + "/notebook");
        await page
            .locator("#notebook-sidebar nav")
            .getByRole("button", { name: /^Orders/ })
            .click();
        await page.locator(".marketplace-drawer > summary").click();
        await page.locator(".marketplace-sync > summary").click();
        await page
            .getByText("Ready for preview · 1 fetched lines · 1/3 attempts", { exact: true })
            .waitFor();
        assert.equal(
            await page
                .getByRole("button", { name: "Save Lazada schedule", exact: true })
                .isDisabled(),
            true,
        );
        await page.getByRole("button", { name: "Next Lazada sync page", exact: true }).click();
        await page.getByText("Page 2 · 26 fetches", { exact: true }).waitFor();
        await page.getByRole("button", { name: "Previous Lazada sync page", exact: true }).click();
        await page.getByRole("button", { name: "Open Lazada batch preview", exact: true }).click();
        await page.getByText("1 new lines", { exact: true }).waitFor();
        assert.equal(
            await page.getByLabel("Marketplace for CSV", { exact: true }).inputValue(),
            "Lazada",
        );
        assert.ok(!reads.some((url) => url.includes("/pages?")));
        assert.deepEqual(
            (await (await context.request.get(base + "/api/notebook")).json()).document,
            document,
        );
        pass(
            "Actual history paging and batch review feed the normal importer without hydration or automatic sales",
        );
        await page.getByRole("button", { name: "Close importer", exact: true }).click();
        for (const width of [320, 390, 768]) {
            await page.setViewportSize({ width, height: 844 });
            assert.ok(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            );
        }
        await page.setViewportSize({ width: 1440, height: 1000 });
        await db`insert into seller_marketplace_sync_runs(owner_id,id,platform,connection_id,status,attempts,from_date,to_date,lease_token,lease_until) values(${user.id},${active},'lazada',${connection},'running',1,'2026-11-05','2026-11-06',${crypto.randomUUID()},now()+interval '1 minute')`;
        await page.getByRole("button", { name: "Turn off Lazada schedule", exact: true }).click();
        await page
            .getByRole("button", { name: "Turn off Lazada schedule", exact: true })
            .waitFor({ state: "hidden" });
        const [cancelled] =
            await db`select status,lease_token from seller_marketplace_sync_runs where owner_id=${user.id} and id=${active}`;
        assert.equal(cancelled.status, "cancelled");
        assert.equal(cancelled.lease_token, null);
        assert.equal((await context.request.get(endpoint + "?run=" + run)).status(), 200);
        pass(
            "Turning off remains available without credentials, cancels in-flight work and retains ready batch access",
        );
        const other = await browser.newContext();
        await signup(other, "notebook-sync-history-other");
        assert.equal((await other.request.get(endpoint + "?run=" + run)).status(), 404);
        assert.equal((await (await other.request.get(endpoint)).json()).total, 0);
        await other.close();
        const anon = await browser.newContext();
        assert.equal((await anon.request.get(endpoint)).status(), 401);
        assert.equal((await anon.request.post(endpoint, { data: {} })).status(), 401);
        await anon.close();
        assert.equal(
            (
                await context.request.post(endpoint, {
                    headers: { Origin: "https://unrelated.example" },
                    data: {},
                })
            ).status(),
            403,
        );
        assert.equal(
            (
                await context.request.get(endpoint, { headers: { "X-Notebook-User": "wrong" } })
            ).status(),
            401,
        );
        assert.equal(
            (
                await context.request.get(endpoint + "?run=------------------------------------")
            ).status(),
            400,
        );
        let releaseReview;
        const gate = new Promise((resolve) => {
            releaseReview = resolve;
        });
        await page.route("**/api/marketplaces/lazada/sync?run=*", async (route) => {
            await gate;
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify(fetched),
            });
        });
        await page.getByRole("button", { name: "Open Lazada batch preview", exact: true }).click();
        await page.getByRole("button", { name: "Disconnect Lazada", exact: true }).click();
        await page
            .getByRole("dialog", { name: "Please confirm", exact: true })
            .getByRole("button", { name: "Continue", exact: true })
            .click();
        await page
            .getByRole("button", { name: "Disconnect Lazada", exact: true })
            .waitFor({ state: "hidden" });
        const late = page.waitForResponse((r) => r.url().includes("/sync?run="));
        releaseReview();
        await (await late).finished();
        await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 100)));
        assert.equal(
            await page.getByRole("button", { name: "Close importer", exact: true }).count(),
            0,
        );
        assert.equal((await context.request.get(endpoint + "?run=" + run)).status(), 404);
        pass("Sync history enforces account binding, safe writes and disconnected-batch guards");
    } catch (error) {
        failure = error;
        console.error(
            "FAIL",
            String(error.message || error).split("\n")[0],
            typeof error.actual === "number"
                ? { actual: error.actual, expected: error.expected }
                : {},
            String(error.stack || "")
                .split("\n")
                .find((line) => line.includes("verify-sync-history.cjs")) || "",
        );
    } finally {
        await browser?.close();
        for (const id of users) {
            try {
                const { neon } = require("@neondatabase/serverless");
                await neon(
                    process.env.DATABASE_URL,
                )`DELETE FROM seller_marketplace_sync_settings WHERE owner_id=${id}`;
                await neon(
                    process.env.DATABASE_URL,
                )`DELETE FROM seller_marketplace_connections WHERE owner_id=${id}`;
                await neon(
                    process.env.DATABASE_URL,
                )`DELETE FROM seller_notebooks WHERE owner_id=${id}`;
                const cli = path.join(process.env.APPDATA, "npm/node_modules/neon/dist/cli.js");
                await promisify(require("node:child_process").execFile)(
                    process.execPath,
                    [cli, "neon-auth", "user", "delete", id],
                    { windowsHide: true },
                );
            } catch (error) {
                failure ??= error;
                console.error("Cleanup failed", error.message);
            }
        }
        fs.writeFileSync(
            "verification/sync-history-e2e.json",
            JSON.stringify(
                {
                    passed: !failure,
                    checks,
                    failure: failure ? String(failure.message).split("\n")[0] : null,
                },
                null,
                2,
            ),
        );
    }
    process.exitCode = failure ? 1 : 0;
})();
