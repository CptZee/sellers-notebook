const { chromium } = require("@playwright/test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { promisify } = require("node:util");
require("@next/env").loadEnvConfig(process.cwd());
const base = "http://127.0.0.1:3000",
    users = [],
    checks = [],
    metrics = {};
const pass = (name) => {
    checks.push(name);
    console.log("PASS " + name);
};
(async () => {
    let browser, failure;
    try {
        browser = await chromium.launch({ channel: "msedge", headless: true });
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }),
            page = await context.newPage();
        const signup = async (ctx, prefix) => {
            const p = await ctx.newPage();
            await p.goto(base + "/auth/sign-up");
            const password = crypto.randomBytes(24).toString("base64url");
            await p.getByLabel("Your name").fill("Pagination review");
            await p.getByLabel("Email address").fill(`${prefix}-${Date.now()}@example.com`);
            await p.getByLabel("Password", { exact: true }).fill(password);
            await p.getByLabel("Confirm password", { exact: true }).fill(password);
            await p.getByRole("button", { name: "Create account", exact: true }).click();
            await p.waitForURL(base + "/notebook");
            const response = await ctx.request.get(base + "/api/notebook/manifest");
            assert.equal(response.status(), 200, await response.text());
            const manifest = await response.json();
            users.push(manifest.user.id);
            await p.close();
            return manifest;
        };
        const initial = await signup(context, "notebook-pages");
        const { createSampleNotebook } = await import("../lib/sample-notebook.mjs");
        const { loadNotebookPages } = await import("../lib/load-notebook.mjs");
        const document = createSampleNotebook();
        const seeded = await context.request.put(base + "/api/notebook", {
            headers: { Origin: base, "X-Notebook-User": initial.user.id },
            data: { revision: 0, document },
        });
        assert.equal(seeded.status(), 200, await seeded.text());
        const revision = (await seeded.json()).revision;
        const full = await context.request.get(base + "/api/notebook"),
            fullBody = await full.json();
        metrics.fullSnapshotBytes = Buffer.byteLength(await full.text());
        const fetched = [];
        const fetcher = async (url, options) => {
            const r = await context.request.get(base + url, { headers: options.headers });
            const body = await r.body();
            fetched.push({ url, bytes: body.length });
            return new Response(body, {
                status: r.status(),
                headers: { "Content-Type": "application/json" },
            });
        };
        const loaded = await loadNotebookPages({ fetcher, userId: initial.user.id });
        assert.deepEqual(loaded.document, fullBody.document);
        const pages = fetched.filter((item) => item.url.includes("/pages?"));
        metrics.hydrationPageRequests = pages.length;
        metrics.largestPageBytes = Math.max(...pages.map((item) => item.bytes));
        assert.ok(metrics.largestPageBytes < metrics.fullSnapshotBytes);
        assert.equal(loaded.document.products.length, 120);
        assert.equal(loaded.document.orders.length, 360);
        assert.equal(loaded.document.purchaseOrders.length, 100);
        for (const item of pages) {
            const r = await context.request.get(base + item.url);
            assert.ok((await r.json()).items.length <= 100);
        }
        pass(
            "SQL pages reassemble all seven collections exactly, including 120 products and 360 orders, with at most 100 records per response",
        );
        for (const query of [
            "collection=owner_id&revision=1",
            "collection=orders&revision=1&limit=101",
            "collection=orders&revision=-1",
        ])
            assert.equal(
                (await context.request.get(base + "/api/notebook/pages?" + query)).status(),
                400,
            );
        assert.equal(
            (
                await context.request.get(base + "/api/notebook/manifest", {
                    headers: { "X-Notebook-User": "wrong-user" },
                })
            ).status(),
            401,
        );
        assert.equal(
            (
                await context.request.get(
                    base + "/api/notebook/inventory?revision=" + revision + "&size=101",
                )
            ).status(),
            400,
        );
        assert.equal(
            (await context.request.get(base + "/api/notebook/backup?revision=999999")).status(),
            409,
        );
        assert.equal(
            (
                await context.request.get(
                    base + "/api/notebook/export?kind=inventory&revision=999999",
                )
            ).status(),
            409,
        );
        pass("Page bounds, collection whitelist and expected-account binding reject invalid reads");
        const browserReads = [];
        page.on("request", (request) => {
            if (
                request.method() === "GET" &&
                new URL(request.url()).pathname.startsWith("/api/notebook")
            )
                browserReads.push(request.url());
        });
        await page.goto(base + "/notebook");
        await page
            .getByText("Live across your devices", { exact: true })
            .waitFor({ timeout: 30000 });
        assert.ok(!browserReads.some((url) => url.includes("/pages?")));
        assert.ok(!browserReads.some((url) => new URL(url).pathname === "/api/notebook"));
        metrics.startupCollectionRequests = browserReads.filter((url) =>
            url.includes("/pages?"),
        ).length;
        pass(
            "Dashboard opening reads only the manifest and SQL report, without downloading collection pages",
        );
        await page
            .locator("#notebook-sidebar nav")
            .getByRole("button", { name: /^Inventory/ })
            .click();
        await page.getByRole("navigation", { name: "Inventory pagination", exact: true }).waitFor();
        assert.equal(await page.locator(".inventory-card tbody tr").count(), 25);
        assert.equal(
            await page.locator(".view-label").innerText(),
            "120 products in your collection",
        );
        await page.getByRole("button", { name: "Inventory: Next page", exact: true }).click();
        await page.locator(".pagination").getByText("Page 2 of 5", { exact: true }).waitFor();
        assert.equal(await page.locator(".inventory-card tbody tr").count(), 25);
        assert.ok(!browserReads.some((url) => url.includes("/pages?")));
        await page
            .getByPlaceholder("Search products…", { exact: true })
            .fill(document.products[119].sku);
        await page
            .locator(".inventory-card tbody tr")
            .getByText(document.products[119].sku, { exact: true })
            .waitFor();
        assert.equal(await page.locator(".inventory-card tbody tr").count(), 1);
        await page.locator(".pagination").getByText("Page 1 of 1", { exact: true }).waitFor();
        const filteredCsv = page.waitForEvent("download");
        await page.getByRole("button", { name: "Export", exact: true }).click();
        assert.equal(
            fs.readFileSync(await (await filteredCsv).path(), "utf8").split("\r\n").length,
            2,
        );
        await page.getByPlaceholder("Search products…", { exact: true }).fill("");
        await page.locator(".pagination").getByText("Page 1 of 5", { exact: true }).waitFor();
        const fullCsv = page.waitForEvent("download");
        await page.getByRole("button", { name: "Export", exact: true }).click();
        assert.equal(
            fs.readFileSync(await (await fullCsv).path(), "utf8").split("\r\n").length,
            121,
        );
        await page
            .getByRole("button", { name: "Open account and sync settings", exact: true })
            .click();
        await page.getByRole("tab", { name: "Notebook", exact: true }).click();
        await page.locator(".notebook-backup>summary").click();
        const backupDownload = page.waitForEvent("download");
        await page.getByRole("button", { name: "Download notebook backup", exact: true }).click();
        const backup = JSON.parse(fs.readFileSync(await (await backupDownload).path(), "utf8"));
        assert.equal(backup.document.products.length, 120);
        assert.equal(backup.document.orders.length, 360);
        assert.equal(backup.document.purchaseOrders.length, 100);
        const identicalRestore = await context.request.put(base + "/api/notebook", {
            headers: {
                Origin: base,
                "X-Notebook-User": initial.user.id,
                "X-Notebook-Restore": "true",
            },
            data: { revision, document: backup.document },
        });
        assert.equal(identicalRestore.status(), 200, await identicalRestore.text());
        assert.equal((await identicalRestore.json()).revision, revision);
        await page.getByRole("button", { name: "Close account", exact: true }).click();
        assert.ok(!browserReads.some((url) => url.includes("/pages?")));
        for (const width of [320, 390, 768]) {
            await page.setViewportSize({ width, height: 844 });
            await page.waitForFunction((width) => innerWidth === width, width);
            const dimensions = await page.evaluate(() => ({
                width: innerWidth,
                scroll: document.documentElement.scrollWidth,
            }));
            assert.ok(dimensions.scroll <= dimensions.width + 1);
            fs.mkdirSync("verification/mobile", { recursive: true });
            await page.screenshot({ path: `verification/mobile/cloud-inventory-${width}.png` });
        }
        await page.setViewportSize({ width: 1440, height: 1000 });
        pass(
            "Inventory reads only visible SQL pages, resets searched pagination, and exports/backups include all matching records without collection hydration",
        );
        browserReads.length = 0;
        const note = "Pagination metadata-only check";
        const changed = { ...document, sidebarNote: note };
        const noteSave = await context.request.put(base + "/api/notebook", {
            headers: { Origin: base },
            data: { revision, document: changed },
        });
        assert.equal(noteSave.status(), 200, await noteSave.text());
        await page.waitForFunction(
            (note) => document.querySelector("#sidebar-personal-note")?.value === note,
            note,
            { timeout: 30000 },
        );
        assert.equal(browserReads.filter((url) => url.includes("/pages?")).length, 0);
        const manifestResponse = await context.request.get(base + "/api/notebook/manifest");
        metrics.metadataRefreshBytes = Buffer.byteLength(await manifestResponse.text());
        assert.ok(metrics.metadataRefreshBytes < metrics.fullSnapshotBytes / 10);
        assert.equal(
            (
                await context.request.get(
                    base + `/api/notebook/pages?collection=orders&revision=${revision}`,
                )
            ).status(),
            409,
        );
        pass(
            "Metadata-only live updates transfer no collection pages, and stale revision pages return 409",
        );
        browserReads.length = 0;
        const nextRevision = (await noteSave.json()).revision;
        const productChange = {
            ...changed,
            products: changed.products.map((p, i) =>
                i ? p : { ...p, name: "Paged inventory update" },
            ),
        };
        const productSave = await context.request.put(base + "/api/notebook", {
            headers: { Origin: base },
            data: { revision: nextRevision, document: productChange },
        });
        assert.equal(productSave.status(), 200, await productSave.text());
        await page
            .locator("#notebook-sidebar nav")
            .getByRole("button", { name: /^Inventory/ })
            .click();
        await page
            .getByText("Paged inventory update", { exact: true })
            .first()
            .waitFor({ timeout: 30000 });
        const productPages = browserReads.filter((url) => url.includes("/pages?"));
        assert.equal(productPages.length, 0);
        assert.ok(browserReads.some((url) => url.includes("/inventory?")));
        pass(
            "A live inventory change refreshes the visible inventory page without downloading unrelated collections",
        );
        const editRow = page
            .locator(".inventory-card tbody tr")
            .filter({ hasText: "Paged inventory update" });
        await editRow.getByRole("button", { name: "Edit", exact: true }).click();
        await page.getByRole("dialog", { name: "Edit product", exact: true }).waitFor();
        assert.ok(!browserReads.some((url) => url.includes("/pages?")));
        assert.ok(browserReads.some((url) => url.includes("/record?")));
        await page.getByRole("button", { name: "Cancel", exact: true }).click();
        assert.equal(
            (await (await context.request.get(base + "/api/notebook")).json()).document.orders
                .length,
            360,
        );
        pass(
            "Opening an editor reads one record without collection hydration and cancellation preserves unloaded records",
        );
        const other = await browser.newContext();
        await signup(other, "notebook-pages-other");
        const otherManifest = await (
            await other.request.get(base + "/api/notebook/manifest")
        ).json();
        assert.equal(otherManifest.collections.products.count, 0);
        assert.deepEqual(
            (await (await other.request.get(base + "/api/notebook/inventory?revision=0")).json())
                .items,
            [],
        );
        assert.equal(
            (
                await (
                    await other.request.get(base + "/api/notebook/export?kind=inventory&revision=0")
                ).text()
            ).split("\r\n").length,
            1,
        );
        assert.equal(
            (await (await other.request.get(base + "/api/notebook/backup?revision=0")).json())
                .document.products.length,
            0,
        );
        const otherPage = await other.request.get(
            base + "/api/notebook/pages?collection=products&revision=0&owner=" + initial.user.id,
        );
        assert.deepEqual((await otherPage.json()).items, []);
        assert.equal(
            (
                await other.request.get(base + "/api/notebook/manifest", {
                    headers: { "X-Notebook-User": initial.user.id },
                })
            ).status(),
            401,
        );
        await other.close();
        const anonymous = await browser.newContext();
        assert.equal((await anonymous.request.get(base + "/api/notebook/manifest")).status(), 401);
        for (const endpoint of [
            "/api/notebook/inventory?revision=0",
            "/api/notebook/export?kind=inventory&revision=0",
            "/api/notebook/backup?revision=0",
        ])
            assert.equal((await anonymous.request.get(base + endpoint)).status(), 401);
        assert.equal(
            (
                await anonymous.request.get(
                    base + "/api/notebook/pages?collection=products&revision=0",
                )
            ).status(),
            401,
        );
        await anonymous.close();
        pass("New read endpoints isolate real accounts and reject anonymous access");
        console.log("METRICS " + JSON.stringify(metrics));
    } catch (error) {
        failure = error;
        console.error("FAIL", String(error.message || error).split("\n")[0]);
    } finally {
        await browser?.close();
        for (const id of users) {
            try {
                const { neon } = require("@neondatabase/serverless");
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
                console.error("Cleanup failed:", error.message);
            }
        }
        fs.writeFileSync(
            "verification/pagination-e2e.json",
            JSON.stringify(
                {
                    passed: !failure,
                    checks,
                    metrics,
                    failure: failure ? String(failure.message).split("\n")[0] : null,
                },
                null,
                2,
            ),
        );
    }
    process.exitCode = failure ? 1 : 0;
})();
