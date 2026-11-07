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
        const user = await signup(context, "notebook-inventory-import"),
            { createSampleNotebook } = await import("../lib/sample-notebook.mjs"),
            document = createSampleNotebook();
        let response = await context.request.put(base + "/api/notebook", {
            headers: { Origin: base },
            data: { revision: 0, document },
        });
        assert.equal(response.status(), 200, await response.text());
        let revision = (await response.json()).revision;
        context.setDefaultTimeout(15000);
        const { readInventoryCsv } = await import("../lib/inventory-import.mjs"),
            text =
                "Product name,SKU,Unit cost,Selling price,Stock,Currency\nNew item,TARGETED-IMPORT,1.25,5.50,7,PHP\nExisting," +
                document.products[105].sku +
                ",1,2,999,PHP\n",
            parsed = readInventoryCsv(text);
        const preview = await context.request.post(base + "/api/notebook/inventory-import", {
            headers: { Origin: base },
            data: { mode: "preview", revision, ...parsed },
        });
        assert.equal(preview.status(), 200, await preview.text());
        const result = await preview.json();
        assert.equal(result.duplicates, 1);
        assert.equal(result.products.length, 1);
        assert.equal(result.errors.length, 0);
        const invalid = await context.request.post(base + "/api/notebook/inventory-import", {
            headers: { Origin: base },
            data: { mode: "preview", revision, rows: parsed.rows, mapping: {} },
        });
        assert.equal(invalid.status(), 200);
        assert.ok((await invalid.json()).errors.length);
        pass(
            "Server inventory preview detects off-page duplicate SKUs and column-mapping errors without exposing collections",
        );
        const page = await context.newPage(),
            reads = [];
        page.on("request", (r) => {
            if (r.method() === "GET") reads.push(r.url());
        });
        await page.goto(base + "/notebook");
        await page
            .locator("#notebook-sidebar nav")
            .getByRole("button", { name: /^Inventory/ })
            .click();
        await page.getByRole("button", { name: "Import inventory CSV", exact: true }).click();
        await page.getByLabel("Choose inventory CSV", { exact: true }).setInputFiles({
            name: "inventory.csv",
            mimeType: "text/csv",
            buffer: Buffer.from(text),
        });
        await page.getByText("1 new products", { exact: true }).waitFor();
        await page.getByLabel("I’ve checked product prices and current stock.").check();
        let failOnce = true;
        await page.route("**/api/notebook/inventory-import", (route) => {
            if (route.request().postDataJSON().mode === "commit" && failOnce) {
                failOnce = false;
                return route.fulfill({
                    status: 503,
                    contentType: "application/json",
                    body: JSON.stringify({ error: "Import retry test" }),
                });
            }
            return route.continue();
        });
        await page.getByRole("button", { name: "Add 1 products", exact: true }).click();
        await page.getByText("Import retry test", { exact: true }).waitFor();
        assert.equal(
            await page.getByLabel("I’ve checked product prices and current stock.").isChecked(),
            true,
        );
        const save = page.waitForResponse(
            (r) =>
                r.url().endsWith("/api/notebook/inventory-import") &&
                r.request().postDataJSON()?.mode === "commit",
        );
        await page.getByRole("button", { name: "Add 1 products", exact: true }).click();
        assert.equal((await save).status(), 200);
        await page.getByText("New products saved to your inventory.", { exact: true }).waitFor();
        let state = await (await context.request.get(base + "/api/notebook")).json();
        assert.equal(state.document.products.length, 121);
        assert.equal(state.document.products.at(-1).sku, "TARGETED-IMPORT");
        assert.deepEqual(state.document.products.slice(0, 120), document.products);
        for (const k of [
            "orders",
            "expenses",
            "suppliers",
            "purchaseOrders",
            "stockAdjustments",
            "refundRecords",
        ])
            assert.deepEqual(state.document[k], document[k]);
        assert.ok(!reads.some((url) => url.includes("/pages?")));
        pass(
            "CSV import retries preserve review and add one product atomically without hydrating or rewriting existing records",
        );
        assert.equal(
            (
                await context.request.post(base + "/api/notebook/inventory-import", {
                    headers: { Origin: base },
                    data: {
                        mode: "commit",
                        revision: state.revision,
                        products: [state.document.products[0]],
                    },
                })
            ).status(),
            409,
        );
        assert.equal(
            (
                await context.request.post(base + "/api/notebook/inventory-import", {
                    headers: { Origin: base },
                    data: { mode: "preview", revision, rows: parsed.rows, mapping: parsed.mapping },
                })
            ).status(),
            409,
        );
        const beforeInvalid = state.revision;
        assert.equal(
            (
                await context.request.post(base + "/api/notebook/inventory-import", {
                    headers: { Origin: base },
                    data: {
                        mode: "commit",
                        revision: beforeInvalid,
                        products: [
                            {
                                ...result.products[0],
                                id: crypto.randomUUID(),
                                sku: "INVALID-NEW-STOCK",
                                stock: -1,
                            },
                        ],
                    },
                })
            ).status(),
            400,
        );
        assert.equal(
            (await (await context.request.get(base + "/api/notebook")).json()).revision,
            beforeInvalid,
        );
        const other = await browser.newContext();
        await signup(other, "notebook-inventory-import-other");
        const isolated = await other.request.post(base + "/api/notebook/inventory-import", {
            headers: { Origin: base },
            data: { mode: "preview", revision: 0, ...parsed },
        });
        assert.equal(isolated.status(), 200);
        assert.equal((await isolated.json()).duplicates, 0);
        await other.close();
        const anon = await browser.newContext();
        assert.equal(
            (
                await anon.request.post(base + "/api/notebook/inventory-import", { data: {} })
            ).status(),
            401,
        );
        await anon.close();
        assert.equal(
            (
                await context.request.post(base + "/api/notebook/inventory-import", {
                    headers: { Origin: "https://unrelated.example" },
                    data: {},
                })
            ).status(),
            403,
        );
        assert.equal(
            (
                await context.request.post(base + "/api/notebook/inventory-import", {
                    headers: { Origin: base, "X-Notebook-User": "wrong" },
                    data: {},
                })
            ).status(),
            401,
        );
        pass(
            "Import commands reject existing-product overwrites, stale previews, anonymous, wrong-account and cross-origin requests",
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
                .find((line) => line.includes("verify-inventory-import-tools.cjs")) || "",
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
            "verification/inventory-import-tools-e2e.json",
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
