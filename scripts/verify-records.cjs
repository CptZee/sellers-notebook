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
        const user = await signup(context, "notebook-records"),
            { createSampleNotebook } = await import("../lib/sample-notebook.mjs"),
            document = createSampleNotebook();
        let response = await context.request.put(base + "/api/notebook", {
            headers: { Origin: base },
            data: { revision: 0, document },
        });
        assert.equal(response.status(), 200, await response.text());
        let revision = (await response.json()).revision;
        const target = document.products[105];
        response = await context.request.get(
            base +
                "/api/notebook/record?" +
                new URLSearchParams({
                    collection: "products",
                    id: target.id,
                    revision: String(revision),
                }),
        );
        assert.equal(response.status(), 200);
        const lookup = await response.json();
        assert.deepEqual(lookup.record, target);
        assert.equal(lookup.count, 120);
        assert.deepEqual(Object.keys(lookup).sort(), ["count", "record", "revision"]);
        async function write(collection, record, expected, extra = {}) {
            return context.request.post(base + "/api/notebook/record", {
                headers: { Origin: base },
                data: {
                    collection,
                    record,
                    expected,
                    id: record?.id || expected?.id,
                    revision,
                    ...extra,
                },
            });
        }
        assert.equal(
            (await write("products", { ...target, stock: target.stock + 1 }, target)).status(),
            409,
        );
        assert.equal(
            (
                await write("products", { ...target, sku: document.products[0].sku }, target)
            ).status(),
            409,
        );
        assert.equal((await write("products", { ...target, cost: -1 }, target)).status(), 400);
        assert.equal((await write("products", target, { ...target, name: "Stale" })).status(), 409);
        assert.equal((await write("products", target, target, { other: true })).status(), 400);
        assert.equal(
            (
                await context.request.get(
                    base + "/api/notebook/record?collection=orders&revision=" + revision,
                )
            ).status(),
            400,
        );
        assert.equal(
            (
                await context.request.get(
                    base +
                        "/api/notebook/record?collection=products&id=missing&revision=" +
                        revision,
                )
            ).status(),
            404,
        );
        assert.equal(
            (
                await context.request.get(
                    base + "/api/notebook/record?collection=products&revision=0",
                )
            ).status(),
            409,
        );
        pass(
            "Individual lookups return one record/count/revision; validation rejects stale values, duplicate SKUs, direct stock changes and malformed requests",
        );
        const page = await context.newPage(),
            reads = [],
            writes = [];
        page.on("request", (request) => {
            if (request.method() === "GET") reads.push(request.url());
            if (request.method() === "POST" && request.url().endsWith("/api/notebook/record"))
                writes.push(request.postDataJSON());
        });
        await page.goto(base + "/notebook");
        await page.getByText("Live across your devices", { exact: true }).waitFor();
        await page
            .locator("#notebook-sidebar nav")
            .getByRole("button", { name: /^Inventory/ })
            .click();
        await page.getByPlaceholder("Search products…").fill(target.sku);
        await page
            .locator(".inventory-card tbody")
            .getByRole("button", { name: "Edit", exact: true })
            .click();
        await page.getByRole("dialog", { name: "Edit product", exact: true }).waitFor();
        await page.getByLabel("Product name", { exact: true }).fill("Targeted browser edit");
        let saved = page.waitForResponse(
            (r) => r.url().endsWith("/api/notebook/record") && r.request().method() === "POST",
        );
        await page.getByRole("button", { name: "Save product", exact: true }).click();
        response = await saved;
        assert.equal(response.status(), 200, await response.text());
        await page
            .getByRole("dialog", { name: "Edit product", exact: true })
            .waitFor({ state: "hidden" });
        await page
            .locator(".inventory-card tbody")
            .getByText("Targeted browser edit", { exact: true })
            .waitFor();
        assert.ok(!reads.some((url) => url.includes("/pages?")));
        assert.deepEqual(Object.keys(writes[0]).sort(), [
            "collection",
            "expected",
            "id",
            "record",
            "revision",
        ]);
        let after = await (await context.request.get(base + "/api/notebook")).json();
        revision = after.revision;
        assert.equal(after.document.products[105].name, "Targeted browser edit");
        assert.equal(after.document.products[105].stock, target.stock);
        for (const key of [
            "orders",
            "expenses",
            "purchaseOrders",
            "suppliers",
            "stockAdjustments",
            "refundRecords",
        ])
            assert.deepEqual(after.document[key], document[key]);
        pass(
            "Editing an off-page product reads/saves only that record and preserves stock, order and purchase history without hydration",
        );
        // A failed create retains input and the same identity, making retry safe.
        await page.getByRole("button", { name: "Add product", exact: true }).click();
        await page.getByLabel("Product name", { exact: true }).fill("Retry product");
        await page.getByLabel("SKU", { exact: true }).fill("RETRY-TARGET-SKU");
        let failOnce = true;
        await page.route("**/api/notebook/record", async (route) => {
            if (route.request().method() === "POST" && failOnce) {
                failOnce = false;
                await route.fulfill({
                    status: 503,
                    contentType: "application/json",
                    body: JSON.stringify({ error: "Temporary record test failure" }),
                });
            } else await route.continue();
        });
        await page.getByRole("button", { name: "Save product", exact: true }).click();
        await page.getByText("Temporary record test failure", { exact: true }).waitFor();
        assert.equal(
            await page.getByLabel("Product name", { exact: true }).inputValue(),
            "Retry product",
        );
        const retryId = writes.at(-1).id;
        saved = page.waitForResponse(
            (r) => r.url().endsWith("/api/notebook/record") && r.request().method() === "POST",
        );
        await page.getByRole("button", { name: "Save product", exact: true }).click();
        assert.equal((await saved).status(), 200);
        await page
            .getByRole("dialog", { name: "New product", exact: true })
            .waitFor({ state: "hidden" });
        assert.equal(writes.at(-1).id, retryId);
        await page.unroute("**/api/notebook/record");
        after = await (await context.request.get(base + "/api/notebook")).json();
        revision = after.revision;
        assert.equal(after.document.products.filter((p) => p.sku === "RETRY-TARGET-SKU").length, 1);
        assert.equal(after.document.products.length, 121);
        assert.ok(!reads.some((url) => url.includes("/pages?")));
        pass(
            "Failed product create preserves the draft and record identity; retry inserts once without downloading collections",
        );
        // A live revision while an individual editor is open must not reset its input.
        await page.getByPlaceholder("Search products…").fill(target.sku);
        await page
            .locator(".inventory-card tbody")
            .getByRole("button", { name: "Edit", exact: true })
            .click();
        await page.getByLabel("Product name", { exact: true }).fill("Unsaved local draft");
        const expected = after.document.products[105],
            newer = { ...expected, name: "Remote product revision" };
        response = await write("products", newer, expected);
        assert.equal(response.status(), 200, await response.text());
        revision = (await response.json()).revision;
        await page
            .locator(".inventory-card tbody")
            .getByText(newer.name, { exact: true })
            .waitFor();
        assert.equal(
            await page.getByLabel("Product name", { exact: true }).inputValue(),
            "Unsaved local draft",
        );
        await page.getByRole("button", { name: "Save product", exact: true }).click();
        await page
            .getByText("This product changed or was removed. Reopen its latest entry.", {
                exact: true,
            })
            .waitFor();
        await page
            .getByRole("dialog", { name: "Edit product", exact: true })
            .getByRole("button", { name: "Cancel", exact: true })
            .click();
        assert.ok(!reads.some((url) => url.includes("/pages?")));
        pass("Live updates preserve the individual product draft and reject stale saves");
        await page.getByRole("button", { name: "Quick create", exact: true }).click();
        await page
            .getByRole("group", { name: "Create a new entry", exact: true })
            .getByRole("button", { name: "New expense", exact: true })
            .click();
        await page.getByRole("dialog", { name: "New expense", exact: true }).waitFor();
        await page.getByLabel("Expense title", { exact: true }).fill("Targeted FAB overhead");
        await page.getByLabel("Amount (₱)", { exact: true }).fill("12.34");
        saved = page.waitForResponse(
            (r) => r.url().endsWith("/api/notebook/record") && r.request().method() === "POST",
        );
        await page.getByRole("button", { name: "Add expense", exact: true }).click();
        assert.equal((await saved).status(), 200);
        await page
            .getByRole("dialog", { name: "New expense", exact: true })
            .waitFor({ state: "hidden" });
        await page
            .locator(".expense-list tbody")
            .getByText("Targeted FAB overhead", { exact: true })
            .waitFor();
        assert.ok(!reads.some((url) => url.includes("/pages?")));
        after = await (await context.request.get(base + "/api/notebook")).json();
        revision = after.revision;
        const expense = after.document.expenses.find((e) => e.title === "Targeted FAB overhead");
        assert.equal(expense.amount, 12.34);
        assert.equal(after.document.expenses.length, 121);
        await page.getByRole("button", { name: "Edit Targeted FAB overhead", exact: true }).click();
        await page.getByLabel("Amount (₱)", { exact: true }).fill("45.67");
        saved = page.waitForResponse(
            (r) => r.url().endsWith("/api/notebook/record") && r.request().method() === "POST",
        );
        await page.getByRole("button", { name: "Save expense", exact: true }).click();
        assert.equal((await saved).status(), 200);
        await page
            .getByRole("dialog", { name: "Edit expense", exact: true })
            .waitFor({ state: "hidden" });
        await page
            .getByRole("button", { name: "Delete Targeted FAB overhead", exact: true })
            .click();
        const dialog = page.getByRole("dialog", { name: "Please confirm", exact: true });
        await dialog.waitFor();
        saved = page.waitForResponse(
            (r) => r.url().endsWith("/api/notebook/record") && r.request().method() === "POST",
        );
        await dialog.getByRole("button", { name: "Continue", exact: true }).click();
        assert.equal((await saved).status(), 200);
        await page
            .locator(".expense-list tbody")
            .getByText("Targeted FAB overhead", { exact: true })
            .waitFor({ state: "hidden" });
        assert.ok(!reads.some((url) => url.includes("/pages?")));
        after = await (await context.request.get(base + "/api/notebook")).json();
        revision = after.revision;
        assert.deepEqual(after.document.expenses, document.expenses);
        assert.deepEqual(after.document.orders, document.orders);
        pass(
            "Expense FAB create, edit and confirmed delete use targeted requests and retain every unseen expense/order",
        );
        for (const width of [320, 390, 768]) {
            await page.setViewportSize({ width, height: 844 });
            await page.getByRole("button", { name: "New expense", exact: true }).click();
            assert.ok(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            );
            await page
                .getByRole("dialog", { name: "New expense", exact: true })
                .getByRole("button", { name: "Cancel", exact: true })
                .click();
        }
        pass("Targeted expense editors fit phone/tablet widths");
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page
            .locator("#notebook-sidebar nav")
            .getByRole("button", { name: /^Pricing calculator/ })
            .click();
        await page.getByLabel("Tax allowance (%)", { exact: true }).fill("5");
        await page.waitForFunction(() =>
            document.querySelector(".price-result h2")?.textContent.includes("290.00"),
        );
        assert.ok(!reads.some((url) => url.includes("/pages?")));
        pass("Pricing calculator accepts its first input without loading notebook collections");
        const anon = await browser.newContext();
        assert.equal(
            (
                await anon.request.get(
                    base + "/api/notebook/record?collection=products&revision=" + revision,
                )
            ).status(),
            401,
        );
        assert.equal(
            (await anon.request.post(base + "/api/notebook/record", { data: {} })).status(),
            401,
        );
        await anon.close();
        const other = await browser.newContext();
        await signup(other, "notebook-records-other");
        assert.equal(
            (
                await other.request.get(
                    base +
                        "/api/notebook/record?collection=products&id=" +
                        target.id +
                        "&revision=0",
                )
            ).status(),
            404,
        );
        assert.equal(
            (
                await other.request.get(
                    base + "/api/notebook/record?collection=products&revision=0",
                    { headers: { "X-Notebook-User": user.id } },
                )
            ).status(),
            401,
        );
        await other.close();
        assert.equal(
            (
                await context.request.post(base + "/api/notebook/record", {
                    headers: { Origin: "https://unrelated.example" },
                    data: {},
                })
            ).status(),
            403,
        );
        pass(
            "Individual record APIs enforce account isolation, expected user identity and same-origin writes",
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
                .find((line) => line.includes("verify-records.cjs")) || "",
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
            "verification/records-e2e.json",
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
