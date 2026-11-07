const { chromium } = require("@playwright/test"),
    assert = require("node:assert/strict"),
    crypto = require("node:crypto"),
    fs = require("node:fs"),
    path = require("node:path");
const { promisify } = require("node:util");
require("@next/env").loadEnvConfig(process.cwd());
const base = process.env.ACCOUNT_DELETION_E2E_BASE_URL || "http://127.0.0.1:3000",
    users = [],
    checks = [];
const pass = (name) => {
    checks.push(name);
    console.log("PASS " + name);
};
(async () => {
    let browser, failure;
    const passwords = new Map(),
        deleted = new Set();
    let files;
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
            passwords.set(user.id, password);
            await p.close();
            return user;
        }

        const user = await signup(context, "notebook-delete"),
            other = await browser.newContext(),
            otherUser = await signup(other, "notebook-keep"),
            { createSampleNotebook } = await import("../lib/sample-notebook.mjs"),
            { backupFingerprint } = await import("../lib/notebook-backup.mjs"),
            document = createSampleNotebook();
        for (const ctx of [context, other]) {
            const response = await ctx.request.put(base + "/api/notebook", {
                headers: { Origin: base },
                data: { revision: 0, document },
            });
            assert.equal(response.status(), 200, await response.text());
        }
        const { Files } = await import("files-sdk"),
            { neon: adapter } = await import("files-sdk/neon");
        files = new Files({ adapter: adapter({ bucket: "assets" }) });
        const fileIds = [];
        for (const ctx of [context, other]) {
            const response = await ctx.request.post(base + "/api/attachments", {
                headers: {
                    Origin: base,
                    "Content-Type": "text/plain",
                    "X-File-Name": "deletion-fixture.txt",
                },
                data: "Private disposable fixture",
            });
            assert.equal(response.status(), 201, await response.text());
            fileIds.push((await response.json()).id);
        }
        await files.upload(
            `notebooks/${user.id}/orphan-fixture`,
            Buffer.from("Orphan cleanup fixture"),
            { contentType: "text/plain" },
        );
        const avatar = Buffer.from("RIFF0000WEBP", "ascii");
        assert.equal(
            (
                await context.request.put(base + "/api/profile-picture", {
                    headers: { Origin: base, "Content-Type": "image/webp" },
                    data: avatar,
                })
            ).status(),
            200,
        );
        const { neon } = require("@neondatabase/serverless"),
            sql = neon(process.env.DATABASE_URL);
        const connection = crypto.randomUUID();
        await sql`insert into seller_shopee_connections(owner_id,connection_id,shop_id,environment,token_ciphertext,expires_at) values(${user.id},${crypto.randomUUID()},'fixture-shop','sandbox','fixture-cipher',now()+interval '1 day')`;
        await sql`insert into seller_marketplace_connections(owner_id,platform,connection_id,account_id,app_fingerprint,token_ciphertext,expires_at) values(${user.id},'lazada',${connection},'fixture-account','fixture-fingerprint','fixture-cipher',now()+interval '1 day')`;
        await sql`insert into seller_marketplace_sync_settings(owner_id,platform,connection_id) values(${user.id},'lazada',${connection})`;
        const [run] =
            await sql`insert into seller_marketplace_sync_runs(owner_id,platform,connection_id,from_date,to_date) values(${user.id},'lazada',${connection},current_date,current_date) returning id`;
        await sql`insert into seller_marketplace_sync_rows(owner_id,run_id,position,source_order_id,sku,quantity,unit_price,ordered_on,status,buyer,currency) values(${user.id},${run.id},0,'fixture-order','fixture-sku',1,10,current_date,'Completed','Marketplace buyer','PHP')`;
        await sql`insert into seller_shopee_auth_states(owner_id,state_hash,expires_at) values(${user.id},${crypto.randomUUID()},now()+interval '5 minutes')`;
        await sql`insert into seller_marketplace_auth_states(owner_id,platform,state_hash,app_fingerprint,expires_at) values(${user.id},'lazada',${crypto.randomUUID()},'fixture-fingerprint',now()+interval '5 minutes')`;
        const otherBefore = await (await other.request.get(base + "/api/notebook")).json();
        const page = await context.newPage();
        await page.goto(base + "/notebook");
        await page.getByText("Live across your devices", { exact: true }).waitFor();
        await page
            .getByRole("button", { name: "Open account and sync settings", exact: true })
            .click();
        await page.getByRole("tab", { name: "Notebook", exact: true }).click();
        await page.getByRole("link", { name: "Delete my account", exact: true }).click();
        await page.getByLabel("Current password", { exact: true }).waitFor();
        for (const width of [320, 390, 768]) {
            await page.setViewportSize({ width, height: 844 });
            assert.ok(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            );
        }
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.getByLabel("Current password", { exact: true }).fill("wrong-password");
        await page.getByLabel("Type DELETE to confirm", { exact: true }).fill("DELETE");
        await page
            .getByLabel("I understand this is permanent and have saved anything I need.", {
                exact: true,
            })
            .check();
        async function confirm() {
            await page
                .getByRole("button", { name: "Permanently delete account", exact: true })
                .click();
            const dialog = page.getByRole("dialog", { name: "Please confirm", exact: true });
            await dialog.waitFor();
            return dialog;
        }
        await (await confirm()).getByRole("button", { name: "Continue", exact: true }).click();
        await page
            .getByRole("alert")
            .filter({ hasText: "Could not verify your password" })
            .waitFor();
        assert.equal(
            (
                await sql`select count(*)::int count from seller_account_deletions where owner_id=${user.id}`
            )[0].count,
            0,
        );
        await page.getByLabel("Current password", { exact: true }).fill(passwords.get(user.id));
        await (await confirm()).getByRole("button", { name: "Cancel", exact: true }).click();
        assert.equal(
            (
                await sql`select count(*)::int count from seller_account_deletions where owner_id=${user.id}`
            )[0].count,
            0,
        );
        pass(
            "Account settings opens deletion; mobile form requires password and confirmation, and wrong password/Cancel leave all data untouched",
        );
        let pause = true;
        await page.route("**/api/account/deletion", async (route) => {
            if (route.request().method() === "DELETE" && pause) {
                pause = false;
                await route.fulfill({
                    status: 503,
                    contentType: "application/json",
                    body: JSON.stringify({ error: "Simulated deletion pause" }),
                });
            } else await route.continue();
        });
        await (await confirm()).getByRole("button", { name: "Continue", exact: true }).click();
        await page.getByRole("alert").filter({ hasText: "Simulated deletion pause" }).waitFor();
        const receipt = await page.evaluate(() =>
            JSON.parse(sessionStorage.getItem("notebook-account-deletion")),
        );
        assert.ok(receipt.id && receipt.token);
        assert.equal((await context.request.get(base + "/api/notebook/manifest")).status(), 401);
        assert.equal(
            (
                await context.request.post(base + "/api/attachments", {
                    headers: {
                        Origin: base,
                        "Content-Type": "text/plain",
                        "X-File-Name": "late.txt",
                    },
                    data: "late",
                })
            ).status(),
            401,
        );
        assert.equal(
            (
                await other.request.get(base + "/api/notebook", {
                    headers: { "X-Notebook-User": user.id },
                })
            ).status(),
            401,
        );
        assert.equal(
            (
                await context.request.delete(base + "/api/account/deletion", {
                    headers: {
                        Origin: "https://unrelated.example",
                        "X-Account-Deletion-Token": receipt.token,
                    },
                    data: { id: receipt.id },
                })
            ).status(),
            403,
        );
        assert.equal(
            (
                await other.request.delete(base + "/api/account/deletion", {
                    headers: { Origin: base, "X-Account-Deletion-Token": "x".repeat(43) },
                    data: { id: receipt.id },
                })
            ).status(),
            401,
        );
        pass(
            "Prepared deletion fences stale sessions/uploads; wrong receipts and cross-origin resumes reject",
        );
        await page.reload();
        await page
            .getByRole("heading", { name: "Your notebook is closed.", exact: true })
            .waitFor({ timeout: 120000 });
        deleted.add(user.id);
        assert.equal(
            await page.evaluate(() => sessionStorage.getItem("notebook-account-deletion")),
            null,
        );
        assert.equal((await context.request.get(base + "/api/notebook")).status(), 401);
        for (const prefix of [`notebooks/${user.id}/`, `profiles/${user.id}/`])
            assert.equal((await files.list({ prefix })).items.length, 0);
        for (const table of [
            "seller_attachments",
            "seller_shopee_connections",
            "seller_shopee_auth_states",
            "seller_marketplace_connections",
            "seller_marketplace_auth_states",
            "seller_marketplace_sync_settings",
            "seller_marketplace_sync_runs",
            "seller_marketplace_sync_rows",
            "seller_notebooks",
            "seller_products",
            "seller_orders",
            "seller_expenses",
        ])
            assert.equal(
                (
                    await sql.query(`select count(*)::int count from ${table} where owner_id=$1`, [
                        user.id,
                    ])
                )[0].count,
                0,
                table,
            );
        assert.equal(
            (await sql`select phase from seller_account_deletions where owner_id=${user.id}`)[0]
                .phase,
            "complete",
        );
        assert.equal(
            backupFingerprint(
                (await (await other.request.get(base + "/api/notebook")).json()).document,
            ),
            backupFingerprint(otherBefore.document),
        );
        assert.equal(
            (await other.request.get(base + "/api/attachments/" + fileIds[1])).status(),
            200,
        );
        pass(
            "Reload resumes deletion of real files/avatar/orphan object, full relational records, encrypted connections and sync data; other account remains intact",
        );
        const resumed = await context.request.delete(base + "/api/account/deletion", {
            headers: { Origin: base, "X-Account-Deletion-Token": receipt.token },
            data: { id: receipt.id },
        });
        assert.equal(resumed.status(), 200);
        assert.equal((await resumed.json()).phase, "complete");
        const fresh = await browser.newContext(),
            login = await fresh.newPage();
        await login.goto(base + "/auth/sign-in");
        await login.getByLabel("Email address", { exact: true }).fill(user.email);
        await login.getByLabel("Password", { exact: true }).fill(passwords.get(user.id));
        await login.getByRole("button", { name: "Sign in", exact: true }).click();
        await login.locator(".auth-error").waitFor();
        await fresh.close();
        await other.close();
        pass("Identity deletion rejects the old password and repeated completion is idempotent");
    } catch (error) {
        failure = error;
        console.error(
            "FAIL",
            String(error.message || error).split("\n")[0],
            String(error.stack || "")
                .split("\n")
                .find((line) => line.includes("verify-account-deletion.cjs")) || "",
        );
    } finally {
        await browser?.close();
        const { Pool, neonConfig } = require("@neondatabase/serverless");
        neonConfig.webSocketConstructor = WebSocket;
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        for (const id of users) {
            try {
                if (files)
                    for (const prefix of [`notebooks/${id}/`, `profiles/${id}/`]) {
                        for (;;) {
                            const page = await files.list({ prefix, limit: 100 });
                            if (!page.items.length) break;
                            for (const file of page.items) await files.delete(file.key);
                        }
                    }
                const client = await pool.connect();
                try {
                    await client.query("BEGIN");
                    await client.query("select set_config('seller.account_cleanup',$1,true)", [id]);
                    for (const table of [
                        "seller_marketplace_sync_settings",
                        "seller_marketplace_auth_states",
                        "seller_marketplace_connections",
                        "seller_shopee_auth_states",
                        "seller_shopee_connections",
                        "seller_attachments",
                        "seller_notebooks",
                        "seller_account_deletions",
                    ])
                        await client.query(`delete from ${table} where owner_id=$1`, [id]);
                    await client.query("COMMIT");
                } finally {
                    client.release();
                }
                if (!deleted.has(id)) {
                    const cli = path.join(process.env.APPDATA, "npm/node_modules/neon/dist/cli.js");
                    await promisify(require("node:child_process").execFile)(
                        process.execPath,
                        [cli, "neon-auth", "user", "delete", id],
                        { windowsHide: true },
                    );
                }
            } catch (error) {
                failure ??= error;
                console.error("Cleanup failed", String(error.message).split("\n")[0]);
            }
        }
        await pool.end();
        fs.writeFileSync(
            "verification/account-deletion-e2e.json",
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
