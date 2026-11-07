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
    let browser, failure, context;
    try {
        browser = await chromium.launch({ channel: "msedge", headless: true });
        context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
        context.setDefaultTimeout(15000);
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
        console.log("CHECK signing up");
        const user = await signup(context, "notebook-restock"),
            { createSampleNotebook } = await import("../lib/sample-notebook.mjs"),
            document = createSampleNotebook();
        document.suppliers[1].productIds = [
            ...new Set([...document.suppliers[1].productIds, document.products[0].id]),
        ];
        document.products[0].stock = 0;
        document.products[0].cost = 1.005;
        document.purchaseOrders[0].status = "Partially received";
        document.purchaseOrders[0].items[0].receivedQuantity = 2;
        document.purchaseOrders[1].status = "Received";
        document.purchaseOrders[1].receivedAt = new Date().toISOString();
        document.purchaseOrders[2].status = "Cancelled";
        document.purchaseOrders[2].cancelledAt = new Date().toISOString();
        let response = await context.request.put(base + "/api/notebook", {
            headers: { Origin: base },
            data: { revision: 0, document },
        });
        assert.equal(response.status(), 200, await response.text());
        let revision = (await response.json()).revision;
        console.log("CHECK comparing restock calculations");
        const { restockIncomingPlan, filterRestockPlan, restockIncomingCsv } =
            await import("../lib/restock-purchase.mjs");
        const all = restockIncomingPlan(document.products, document.purchaseOrders);
        let cases = 0;
        for (const supplierId of ["all", "unlinked", document.suppliers[0].id])
            for (const view of [
                "All low-stock products",
                "Needs buying",
                "Covered by incoming stock",
            ])
                for (const search of ["", "MUG"]) {
                    const expected = filterRestockPlan(all, document.suppliers, {
                            supplierId,
                            view,
                            search,
                        }),
                        params = new URLSearchParams({
                            revision: String(revision),
                            supplierId,
                            view,
                            search,
                            size: "10",
                            page: "999",
                        });
                    const r = await context.request.get(base + "/api/notebook/restock?" + params);
                    assert.equal(r.status(), 200, await r.text());
                    const data = await r.json(),
                        last = Math.max(1, Math.ceil(expected.length / 10));
                    assert.equal(data.page, last);
                    assert.deepEqual(
                        data.items.map(({ suppliers, ...item }) => item),
                        expected.slice((last - 1) * 10, last * 10),
                    );
                    assert.equal(
                        Number(data.quantity),
                        expected.reduce((n, i) => n + i.toBuy, 0),
                    );
                    assert.equal(
                        Number(data.incoming),
                        expected.reduce((n, i) => n + i.onOrder, 0),
                    );
                    assert.equal(
                        Number(data.estimate),
                        expected.reduce((n, i) => n + Math.round(i.buyEstimate * 100), 0) / 100,
                    );
                    assert.equal(data.lowCount, all.length);
                    const csv = await context.request.get(
                        base + "/api/notebook/restock?" + params + "&mode=csv",
                    );
                    assert.equal(csv.status(), 200);
                    assert.equal(
                        (await csv.text()).replace(/^\uFEFF/, ""),
                        restockIncomingCsv(expected, document.suppliers).replace(/^\uFEFF/, ""),
                    );
                    cases++;
                }
        pass(
            cases +
                " SQL filter combinations and complete CSVs match restock helpers, totals and page clamping",
        );
        const item = all.find(
                (i) => i.toBuy > 0 && document.suppliers.some((s) => s.productIds.includes(i.id)),
            ),
            supplier = document.suppliers.find((s) => s.productIds.includes(item.id));
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
        await page.getByRole("button", { name: "Plan a restock", exact: true }).click();
        await page.getByLabel("Restock supplier", { exact: true }).selectOption(supplier.id);
        await page.getByLabel("Search restock products", { exact: true }).fill(item.sku);
        await page.getByRole("button", { name: "Prepare purchase order", exact: true }).click();
        const modal = page.getByRole("dialog", { name: "New purchase order", exact: true });
        await modal.waitFor();
        assert.equal(
            Number(await page.getByLabel("Purchase units 1", { exact: true }).inputValue()),
            item.toBuy,
        );
        await page.getByRole("button", { name: "Cancel purchase entry", exact: true }).click();
        assert.deepEqual(
            (await (await context.request.get(base + "/api/notebook")).json()).document,
            document,
        );
        assert.ok(!reads.some((url) => url.includes("/pages?")));
        pass(
            "Planner search and editable purchase preparation use targeted reads; cancelling preserves all records",
        );
        await page.getByRole("button", { name: "Prepare purchase order", exact: true }).click();
        await modal.waitFor();
        await page.getByLabel("Purchase units 1", { exact: true }).fill("1");
        const saved = page.waitForResponse(
            (r) => r.url().endsWith("/api/notebook/purchase") && r.request().method() === "POST",
        );
        await modal.getByRole("button", { name: "Save purchase order", exact: true }).click();
        assert.equal((await saved).status(), 200);
        await modal.waitFor({ state: "hidden" });
        const after = await (await context.request.get(base + "/api/notebook")).json();
        assert.equal(after.document.purchaseOrders.length, document.purchaseOrders.length + 1);
        assert.equal(after.document.purchaseOrders[0].items[0].quantity, 1);
        assert.deepEqual(after.document.products, document.products);
        assert.deepEqual(after.document.stockAdjustments, document.stockAdjustments);
        assert.ok(!reads.some((url) => url.includes("/pages?")));
        pass(
            "Edited restock draft saves one purchase without changing stock or loading collections",
        );
        const other = await browser.newContext();
        await signup(other, "notebook-restock-other");
        const isolated = await other.request.get(base + "/api/notebook/restock?revision=0");
        assert.equal(isolated.status(), 200);
        assert.equal((await isolated.json()).total, 0);
        await other.close();
        const anon = await browser.newContext();
        assert.equal(
            (await anon.request.get(base + "/api/notebook/restock?revision=0")).status(),
            401,
        );
        await anon.close();
        assert.equal(
            (await context.request.get(base + "/api/notebook/restock?revision=0")).status(),
            409,
        );
        assert.equal(
            (
                await context.request.get(
                    base + "/api/notebook/restock?revision=" + revision + "&view=invalid",
                )
            ).status(),
            400,
        );
        assert.equal(
            (
                await context.request.get(base + "/api/notebook/restock?revision=" + revision, {
                    headers: { "X-Notebook-User": "wrong" },
                })
            ).status(),
            401,
        );
        pass("Planner rejects anonymous, wrong-account, stale and invalid requests");
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
                .find((line) => line.includes("verify-restock-tools.cjs")) || "",
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
            "verification/restock-tools-e2e.json",
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
