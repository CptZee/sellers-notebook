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
        const user = await signup(context, "notebook-marketplace-import"),
            { createSampleNotebook } = await import("../lib/sample-notebook.mjs"),
            document = createSampleNotebook();
        let response = await context.request.put(base + "/api/notebook", {
            headers: { Origin: base },
            data: { revision: 0, document },
        });
        assert.equal(response.status(), 200, await response.text());
        let revision = (await response.json()).revision;
        context.setDefaultTimeout(15000);
        const { readShopeeCsv, previewShopeeImport } = await import("../lib/shopee-import.mjs"),
            csv =
                "Order ID,Seller SKU,Quantity,Unit Price,Order Date,Order Status,Buyer Username,Currency\nMARKET-IMPORT-1," +
                document.products[105].sku +
                ",2,10.50,2026-11-05,Completed,Market buyer,PHP\nMARKET-IMPORT-1," +
                document.products[0].sku +
                ",1,20.00,2026-11-05,Processing,Market buyer,PHP\n",
            parsed = readShopeeCsv(csv),
            options = { fee: 8, packaging: 15, shipping: 20, dateFormat: "ISO" };
        const request = async (mode, platform, rows = parsed.rows, rev = revision) =>
            context.request.post(base + "/api/notebook/marketplace-import", {
                headers: { Origin: base },
                data: { mode, platform, rows, mapping: parsed.mapping, options, revision: rev },
            });
        let existing = document.orders;
        for (const platform of ["Shopee", "Lazada", "TikTok Shop"]) {
            const response = await request("preview", platform);
            assert.equal(response.status(), 200, await response.text());
            const preview = await response.json(),
                expected = await previewShopeeImport(
                    parsed.rows,
                    parsed.mapping,
                    document.products,
                    existing,
                    options,
                    platform,
                );
            assert.deepEqual(preview.orders, expected.orders);
            assert.equal(preview.errors.length, 0);
            assert.equal(preview.products.length, 2);
            const saved = await request("commit", platform);
            assert.equal(saved.status(), 200, await saved.text());
            revision = (await saved.json()).revision;
            existing = [...expected.orders, ...existing];
            const duplicate = await request("preview", platform);
            assert.equal(duplicate.status(), 200);
            const dup = await duplicate.json();
            assert.equal(dup.duplicates, 2);
            assert.equal(dup.orders.length, 0);
            const partial = [{ ...parsed.rows[0], "Seller SKU": document.products[106].sku }],
                later = await request("preview", platform, partial);
            assert.equal(later.status(), 200);
            const next = await later.json();
            assert.equal(next.orders[0].packaging, 0);
            assert.equal(next.orders[0].shipping, 0);
            assert.equal(next.orders[0].fee, 8);
        }
        let state = await (await context.request.get(base + "/api/notebook")).json();
        assert.deepEqual(state.document.products, document.products);
        assert.equal(state.document.orders.length, document.orders.length + 6);
        for (const key of [
            "expenses",
            "purchaseOrders",
            "stockAdjustments",
            "refundRecords",
            "suppliers",
        ])
            assert.deepEqual(state.document[key], document[key]);
        pass(
            "All three platforms match preview helpers, separate duplicate identities and charge costs once per order including later lines; stock and unrelated records stay unchanged",
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
        await page.getByRole("button", { name: "Import orders CSV", exact: true }).click();
        await page.getByLabel("Marketplace for CSV", { exact: true }).selectOption("Lazada");
        const browserCsv = csv.replaceAll("MARKET-IMPORT-1", "BROWSER-MARKET-2");
        await page.getByLabel("Choose Lazada CSV", { exact: true }).setInputFiles({
            name: "lazada.csv",
            mimeType: "text/csv",
            buffer: Buffer.from(browserCsv),
        });
        await page.getByText("2 new lines", { exact: true }).waitFor();
        await page
            .getByLabel("I’ve reviewed the prices and cost defaults. Keep current stock unchanged.")
            .check();
        let failOnce = true;
        await page.route("**/api/notebook/marketplace-import", (route) => {
            if (route.request().postDataJSON().mode === "commit" && failOnce) {
                failOnce = false;
                return route.fulfill({
                    status: 503,
                    contentType: "application/json",
                    body: JSON.stringify({ error: "Marketplace import retry test" }),
                });
            }
            return route.continue();
        });
        await page.getByRole("button", { name: "Add 2 order lines", exact: true }).click();
        await page.getByText("Marketplace import retry test", { exact: true }).waitFor();
        assert.equal(
            await page
                .getByLabel(
                    "I’ve reviewed the prices and cost defaults. Keep current stock unchanged.",
                )
                .isChecked(),
            true,
        );
        const saved = page.waitForResponse(
            (r) =>
                r.url().endsWith("/api/notebook/marketplace-import") &&
                r.request().postDataJSON()?.mode === "commit",
        );
        await page.getByRole("button", { name: "Add 2 order lines", exact: true }).click();
        assert.equal((await saved).status(), 200);
        await page.getByText("2 order lines saved.", { exact: true }).waitFor();
        state = await (await context.request.get(base + "/api/notebook")).json();
        revision = state.revision;
        assert.equal(state.document.orders.length, document.orders.length + 8);
        assert.deepEqual(state.document.products, document.products);
        assert.ok(!reads.some((url) => url.includes("/pages?")));
        pass(
            "Browser marketplace import preserves review after failure and saves historical lines without collection hydration",
        );
        const missing = [{ ...parsed.rows[0], "Seller SKU": "FOREIGN-SKU" }],
            invalid = await request("preview", "Shopee", missing);
        assert.equal(invalid.status(), 200);
        assert.ok((await invalid.json()).errors.length);
        assert.equal((await request("commit", "Shopee", missing)).status(), 400);
        assert.equal((await request("preview", "Shopee", parsed.rows, 0)).status(), 409);
        const other = await browser.newContext();
        await signup(other, "notebook-marketplace-import-other");
        const isolated = await other.request.post(base + "/api/notebook/marketplace-import", {
            headers: { Origin: base },
            data: { mode: "preview", revision: 0, platform: "Shopee", ...parsed, options },
        });
        assert.equal(isolated.status(), 200);
        assert.equal((await isolated.json()).products.length, 0);
        await other.close();
        const anon = await browser.newContext();
        assert.equal(
            (
                await anon.request.post(base + "/api/notebook/marketplace-import", { data: {} })
            ).status(),
            401,
        );
        await anon.close();
        assert.equal(
            (
                await context.request.post(base + "/api/notebook/marketplace-import", {
                    headers: { Origin: "https://unrelated.example" },
                    data: {},
                })
            ).status(),
            403,
        );
        assert.equal(
            (
                await context.request.post(base + "/api/notebook/marketplace-import", {
                    headers: { Origin: base, "X-Notebook-User": "wrong" },
                    data: {},
                })
            ).status(),
            401,
        );
        pass(
            "Missing products, stale revisions, foreign accounts, anonymous callers and cross-origin imports are guarded",
        );
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
                .find((line) => line.includes("verify-marketplace-import-tools.cjs")) || "",
        );
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
                console.error("Cleanup failed", error.message);
            }
        }
        fs.writeFileSync(
            "verification/marketplace-import-tools-e2e.json",
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
