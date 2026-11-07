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
        const user = await signup(context, "notebook-supplier-import"),
            { createSampleNotebook } = await import("../lib/sample-notebook.mjs"),
            document = createSampleNotebook();
        let response = await context.request.put(base + "/api/notebook", {
            headers: { Origin: base },
            data: { revision: 0, document },
        });
        assert.equal(response.status(), 200, await response.text());
        let revision = (await response.json()).revision;
        context.setDefaultTimeout(15000);
        const text =
            "Supplier,Contact person,Email,Lead time (days),Product SKUs\nTargeted Import Supply,Alex,alex@example.com,7," +
            document.products[105].sku +
            "\n" +
            document.suppliers[50].name +
            ",Existing,,0,\n";
        const preview = await context.request.post(base + "/api/notebook/supplier-import", {
            headers: { Origin: base },
            data: { mode: "preview", revision, text },
        });
        assert.equal(preview.status(), 200, await preview.text());
        const result = await preview.json();
        assert.equal(result.duplicates, 1);
        assert.equal(result.suppliers.length, 1);
        assert.equal(result.errors.length, 0);
        assert.deepEqual(result.suppliers[0].productIds, [document.products[105].id]);
        assert.deepEqual(result.products, [
            { id: document.products[105].id, sku: document.products[105].sku },
        ]);
        const invalid = await context.request.post(base + "/api/notebook/supplier-import", {
            headers: { Origin: base },
            data: {
                mode: "preview",
                revision,
                text: "Supplier,Product SKUs\nUnknown Supply,MISSING-SKU\n",
            },
        });
        assert.equal(invalid.status(), 200);
        assert.ok(
            (await invalid.json()).errors.some((e) => e.message.includes("Unknown inventory SKUs")),
        );
        pass(
            "Supplier previews skip off-page duplicate names and resolve only owned referenced SKUs with labels and missing-link errors",
        );
        const page = await context.newPage(),
            reads = [];
        page.on("request", (r) => {
            if (r.method() === "GET") reads.push(r.url());
        });
        await page.goto(base + "/notebook");
        await page
            .locator("#notebook-sidebar nav")
            .getByRole("button", { name: /^Suppliers/ })
            .click();
        await page.getByRole("button", { name: "Import suppliers CSV", exact: true }).click();
        await page.getByLabel("Choose supplier CSV", { exact: true }).setInputFiles({
            name: "suppliers.csv",
            mimeType: "text/csv",
            buffer: Buffer.from(text),
        });
        await page.getByText("1 new suppliers", { exact: true }).waitFor();
        await page.getByLabel("I’ve checked the supplier details and product links.").check();
        let failOnce = true;
        await page.route("**/api/notebook/supplier-import", (route) => {
            if (route.request().postDataJSON().mode === "commit" && failOnce) {
                failOnce = false;
                return route.fulfill({
                    status: 503,
                    contentType: "application/json",
                    body: JSON.stringify({ error: "Supplier import retry test" }),
                });
            }
            return route.continue();
        });
        await page.getByRole("button", { name: "Add 1 suppliers", exact: true }).click();
        await page.getByText("Supplier import retry test", { exact: true }).waitFor();
        assert.equal(
            await page
                .getByLabel("I’ve checked the supplier details and product links.")
                .isChecked(),
            true,
        );
        const save = page.waitForResponse(
            (r) =>
                r.url().endsWith("/api/notebook/supplier-import") &&
                r.request().postDataJSON()?.mode === "commit",
        );
        await page.getByRole("button", { name: "Add 1 suppliers", exact: true }).click();
        assert.equal((await save).status(), 200);
        await page.getByText("Supplier contacts saved.", { exact: true }).waitFor();
        let state = await (await context.request.get(base + "/api/notebook")).json();
        assert.equal(state.document.suppliers.length, 101);
        assert.equal(state.document.suppliers.at(-1).name, "Targeted Import Supply");
        assert.deepEqual(state.document.suppliers.at(-1).productIds, [document.products[105].id]);
        assert.deepEqual(state.document.suppliers.slice(0, 100), document.suppliers);
        for (const k of [
            "products",
            "orders",
            "expenses",
            "purchaseOrders",
            "stockAdjustments",
            "refundRecords",
        ])
            assert.deepEqual(state.document[k], document[k]);
        assert.ok(!reads.some((url) => url.includes("/pages?")));
        pass(
            "Failed supplier import retains review; retry saves one linked supplier without hydration or changing inventory and finances",
        );
        assert.equal(
            (
                await context.request.post(base + "/api/notebook/supplier-import", {
                    headers: { Origin: base },
                    data: {
                        mode: "commit",
                        revision: state.revision,
                        suppliers: [state.document.suppliers[0]],
                    },
                })
            ).status(),
            409,
        );
        assert.equal(
            (
                await context.request.post(base + "/api/notebook/supplier-import", {
                    headers: { Origin: base },
                    data: { mode: "preview", revision, text },
                })
            ).status(),
            409,
        );
        assert.equal(
            (
                await context.request.post(base + "/api/notebook/supplier-import", {
                    headers: { Origin: base },
                    data: {
                        mode: "commit",
                        revision: state.revision,
                        suppliers: [
                            {
                                ...result.suppliers[0],
                                id: crypto.randomUUID(),
                                name: "Invalid linked import",
                                productIds: ["foreign-product"],
                            },
                        ],
                    },
                })
            ).status(),
            400,
        );
        assert.equal(
            (await (await context.request.get(base + "/api/notebook")).json()).revision,
            state.revision,
        );
        const other = await browser.newContext();
        await signup(other, "notebook-supplier-import-other");
        const isolated = await other.request.post(base + "/api/notebook/supplier-import", {
            headers: { Origin: base },
            data: { mode: "preview", revision: 0, text },
        });
        assert.equal(isolated.status(), 200);
        const isolatedData = await isolated.json();
        assert.equal(isolatedData.duplicates, 0);
        assert.equal(isolatedData.products.length, 0);
        assert.ok(isolatedData.errors.length);
        await other.close();
        const anon = await browser.newContext();
        assert.equal(
            (
                await anon.request.post(base + "/api/notebook/supplier-import", { data: {} })
            ).status(),
            401,
        );
        await anon.close();
        assert.equal(
            (
                await context.request.post(base + "/api/notebook/supplier-import", {
                    headers: { Origin: "https://unrelated.example" },
                    data: {},
                })
            ).status(),
            403,
        );
        assert.equal(
            (
                await context.request.post(base + "/api/notebook/supplier-import", {
                    headers: { Origin: base, "X-Notebook-User": "wrong" },
                    data: {},
                })
            ).status(),
            401,
        );
        pass(
            "Supplier imports reject overwrites, stale previews and foreign product links; account and origin guards hold",
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
                .find((line) => line.includes("verify-supplier-import-tools.cjs")) || "",
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
            "verification/supplier-import-tools-e2e.json",
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
