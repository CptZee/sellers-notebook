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
        const user = await signup(context, "notebook-order-tools"),
            { createSampleNotebook } = await import("../lib/sample-notebook.mjs"),
            { orderGroup, customerOrderHtml } = await import("../lib/order-copy.mjs"),
            document = createSampleNotebook(),
            today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(
                new Date(),
            );
        const first = document.orders[0],
            second = document.orders[1],
            foreign = document.orders[2];
        first.sourceOrderId = "GROUP-TARGET-ORDER";
        second.sourceOrderId = " group-target-order ";
        second.channel = first.channel;
        first.status = second.status = "Completed";
        foreign.sourceOrderId = first.sourceOrderId;
        foreign.channel = first.channel === "Shopee" ? "Lazada" : "Shopee";
        document.refundRecords.unshift(
            ...Array.from({ length: 30 }, (_, i) => ({
                id: "target-history-" + i,
                orderId: first.id,
                amount: 0.01,
                date: today,
                reason: "PRIVATE-OLDER-REFUND-" + i,
            })),
        );
        let response = await context.request.put(base + "/api/notebook", {
            headers: { Origin: base },
            data: { revision: 0, document },
        });
        assert.equal(response.status(), 200, await response.text());
        let revision = (await response.json()).revision;
        response = await context.request.get(
            base +
                "/api/notebook/order?" +
                new URLSearchParams({ id: first.id, revision: String(revision) }),
        );
        assert.equal(response.status(), 200, await response.text());
        let group = await response.json();
        assert.deepEqual(group.orders, orderGroup(document.orders, first.id));
        assert.deepEqual(
            group.refunds,
            document.refundRecords.filter((r) => group.orders.some((o) => o.id === r.orderId)),
        );
        assert.equal(group.orders.length, 2);
        assert.ok(!group.orders.some((o) => o.id === foreign.id));
        assert.deepEqual(Object.keys(group).sort(), ["orders", "refunds", "revision"]);
        const product = document.products[1],
            sale = (id, extra = {}) => ({
                kind: "sale",
                id,
                revision,
                expected: product,
                input: {
                    customer: "Atomic buyer",
                    channel: "Direct",
                    quantity: 2,
                    fee: 8,
                    packaging: 15,
                    shipping: 0,
                    date: today,
                },
                ...extra,
            });
        assert.equal(
            (
                await context.request.post(base + "/api/notebook/order", {
                    headers: { Origin: base },
                    data: sale("bad-stock", { expected: { ...product, stock: product.stock + 1 } }),
                })
            ).status(),
            409,
        );
        assert.equal(
            (
                await context.request.post(base + "/api/notebook/order", {
                    headers: { Origin: base },
                    data: sale("bad-price", { input: { ...sale("x").input, price: 0.01 } }),
                })
            ).status(),
            409,
        );
        const raced = await Promise.all(
            ["atomic-a", "atomic-b"].map((id) =>
                context.request.post(base + "/api/notebook/order", {
                    headers: { Origin: base },
                    data: sale(id),
                }),
            ),
        );
        assert.deepEqual(
            raced.map((r) => r.status()).sort(),
            [200, 409],
            JSON.stringify(await Promise.all(raced.map((r) => r.text()))),
        );
        let after = await (await context.request.get(base + "/api/notebook")).json();
        revision = after.revision;
        assert.equal(after.document.orders.length, 361);
        assert.equal(
            after.document.products.find((p) => p.id === product.id).stock,
            product.stock - 2,
        );
        for (const key of [
            "expenses",
            "suppliers",
            "purchaseOrders",
            "stockAdjustments",
            "refundRecords",
        ])
            assert.deepEqual(after.document[key], document[key]);
        pass(
            "Grouped lookup matches existing case/whitespace/channel rules; concurrent sales commit once with atomic stock reservation and no unrelated changes",
        );
        const page = await context.newPage(),
            reads = [],
            writes = [];
        page.on("request", (request) => {
            if (request.method() === "GET") reads.push(request.url());
            if (request.method() === "POST" && request.url().endsWith("/api/notebook/order"))
                writes.push(request.postDataJSON());
        });
        await page.goto(base + "/notebook");
        await page.getByText("Live across your devices", { exact: true }).waitFor();
        await page
            .locator("#notebook-sidebar nav")
            .getByRole("button", { name: /^Orders/ })
            .click();
        await page.getByLabel("Search orders", { exact: true }).fill(first.sourceOrderId);
        let failRead = true;
        await page.route("**/api/notebook/order?*", async (route) => {
            if (failRead) {
                failRead = false;
                await route.fulfill({
                    status: 503,
                    contentType: "application/json",
                    body: JSON.stringify({ error: "Temporary group test failure" }),
                });
            } else await route.continue();
        });
        await page
            .getByRole("button", { name: new RegExp("Details for " + first.channel + " order") })
            .first()
            .click();
        await page
            .getByRole("status")
            .filter({ hasText: "Temporary group test failure" })
            .waitFor();
        await page.getByRole("button", { name: "Retry order", exact: true }).click();
        await page
            .locator(".order-details-modal .order-detail-meta")
            .getByText("2", { exact: true })
            .waitFor();
        assert.ok(!reads.some((url) => url.includes("/pages?")));
        const download = page.waitForEvent("download");
        await page.getByRole("button", { name: "Download customer copy", exact: true }).click();
        let html = fs.readFileSync(await (await download).path(), "utf8");
        assert.ok(html.includes(first.productName));
        assert.ok(html.includes(second.productName));
        assert.ok(!html.includes("PRIVATE-OLDER-REFUND"));
        assert.ok(!html.includes("ajmission.dev"));
        assert.equal(html, customerOrderHtml(group.orders, document.branding, group.refunds));
        const popupPromise = page.waitForEvent("popup");
        await page.getByRole("button", { name: "Print customer copy", exact: true }).click();
        const popup = await popupPromise;
        await popup.getByRole("heading", { name: "Order summary", exact: true }).waitFor();
        await popup.close();
        await page.unroute("**/api/notebook/order?*");
        await page.locator(".order-refunds > summary").click();
        await page
            .getByRole("navigation", { name: "Order refunds pagination", exact: true })
            .getByText("Page 1 of 2", { exact: true })
            .waitFor();
        await page.getByLabel("Refund order line", { exact: true }).selectOption(first.id);
        await page.getByLabel("Refund amount (PHP)", { exact: true }).fill("1.25");
        await page.getByLabel("Refund reason", { exact: true }).fill("PRIVATE-NEW-REFUND");
        let saved = page.waitForResponse(
            (r) => r.url().endsWith("/api/notebook/order") && r.request().method() === "POST",
        );
        await page.getByRole("button", { name: "Record issued refund", exact: true }).click();
        assert.equal((await saved).status(), 200);
        await page
            .locator(".refund-record")
            .getByText("PRIVATE-NEW-REFUND", { exact: true })
            .waitFor();
        after = await (await context.request.get(base + "/api/notebook")).json();
        revision = after.revision;
        const refund = after.document.refundRecords.find((r) => r.reason === "PRIVATE-NEW-REFUND");
        assert.equal(refund.amount, 1.25);
        assert.equal(
            after.document.products.find((p) => p.id === product.id).stock,
            product.stock - 2,
        );
        await page
            .locator(".refund-record")
            .filter({ hasText: "PRIVATE-NEW-REFUND" })
            .getByRole("button", { name: "Remove record", exact: true })
            .click();
        const dialog = page.getByRole("dialog", { name: "Please confirm", exact: true });
        await dialog.waitFor();
        saved = page.waitForResponse(
            (r) => r.url().endsWith("/api/notebook/order") && r.request().method() === "POST",
        );
        await dialog.getByRole("button", { name: "Continue", exact: true }).click();
        assert.equal((await saved).status(), 200);
        await page
            .locator(".refund-record")
            .getByText("PRIVATE-NEW-REFUND", { exact: true })
            .waitFor({ state: "hidden" });
        await page.getByRole("button", { name: "Close order details", exact: true }).click();
        assert.ok(!reads.some((url) => url.includes("/pages?")));
        pass(
            "Details retry safely, include all grouped refunds/copies, and create/remove refund bookkeeping without collection hydration or stock changes",
        );
        const selected = document.products.find((p, index) => index > 100 && p.stock >= 3);
        await page.getByRole("button", { name: "Quick create", exact: true }).click();
        await page
            .getByRole("group", { name: "Create a new entry", exact: true })
            .getByRole("button", { name: "Record a sale", exact: true })
            .click();
        await page.getByRole("dialog", { name: "Record a sale", exact: true }).waitFor();
        await page
            .getByRole("navigation", { name: "Sale products pagination", exact: true })
            .waitFor();
        await page.waitForFunction(() => !!document.querySelector("select[name=product]")?.value);
        const picked = await page.getByLabel("Product", { exact: true }).inputValue();
        await page.getByLabel("Sale products rows per page", { exact: true }).selectOption("10");
        await page
            .getByRole("navigation", { name: "Sale products pagination", exact: true })
            .getByText("Page 1 of 12", { exact: true })
            .waitFor();
        await page.getByRole("button", { name: "Sale products: Next page", exact: true }).click();
        await page
            .getByRole("navigation", { name: "Sale products pagination", exact: true })
            .getByText("Page 2 of 12", { exact: true })
            .waitFor();
        assert.equal(await page.getByLabel("Product", { exact: true }).inputValue(), picked);
        await page.getByLabel("Find a sale product", { exact: true }).fill(selected.sku);
        await page.getByLabel("Product", { exact: true }).selectOption(selected.id);
        await page.getByLabel("Customer name", { exact: true }).fill("Paged picker buyer");
        await page.getByLabel("Quantity", { exact: true }).fill("3");
        let failWrite = true;
        await page.route("**/api/notebook/order", async (route) => {
            if (route.request().method() === "POST" && failWrite) {
                failWrite = false;
                await route.fulfill({
                    status: 503,
                    contentType: "application/json",
                    body: JSON.stringify({ error: "Temporary sale test failure" }),
                });
            } else await route.continue();
        });
        await page.getByRole("button", { name: "Record sale", exact: true }).click();
        await page.getByText("Temporary sale test failure", { exact: true }).waitFor();
        assert.equal(
            await page.getByLabel("Customer name", { exact: true }).inputValue(),
            "Paged picker buyer",
        );
        const draftId = writes.at(-1).id;
        saved = page.waitForResponse(
            (r) => r.url().endsWith("/api/notebook/order") && r.request().method() === "POST",
        );
        await page.getByRole("button", { name: "Record sale", exact: true }).click();
        assert.equal((await saved).status(), 200);
        await page
            .getByRole("dialog", { name: "Record a sale", exact: true })
            .waitFor({ state: "hidden" });
        assert.equal(writes.at(-1).id, draftId);
        await page.unroute("**/api/notebook/order");
        after = await (await context.request.get(base + "/api/notebook")).json();
        revision = after.revision;
        const created = after.document.orders.find((o) => o.customer === "Paged picker buyer");
        assert.equal(created.productId, selected.id);
        assert.equal(created.quantity, 3);
        assert.equal(created.price, selected.price);
        assert.equal(
            after.document.products.find((p) => p.id === selected.id).stock,
            selected.stock - 3,
        );
        assert.ok(!reads.some((url) => url.includes("/pages?")));
        pass(
            "FAB sale finds an off-page product, preserves draft/identity after failure, and records stock and server prices once without hydration",
        );
        for (const width of [320, 390, 768]) {
            await page.setViewportSize({ width, height: 844 });
            await page
                .locator(".page-heading")
                .getByRole("button", { name: "Record a sale", exact: true })
                .click();
            await page
                .getByRole("navigation", { name: "Sale products pagination", exact: true })
                .waitFor();
            assert.ok(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            );
            await page
                .getByRole("dialog", { name: "Record a sale", exact: true })
                .getByRole("button", { name: "Cancel", exact: true })
                .click();
        }
        pass("Paged sale picker and form fit phone/tablet widths");
        assert.equal(
            (
                await context.request.get(
                    base + "/api/notebook/order?id=" + first.id + "&revision=0",
                )
            ).status(),
            409,
        );
        assert.equal(
            (
                await context.request.get(
                    base + "/api/notebook/order?id=missing&revision=" + revision,
                )
            ).status(),
            404,
        );
        assert.equal(
            (
                await context.request.post(base + "/api/notebook/order", {
                    headers: { Origin: "https://unrelated.example" },
                    data: {},
                })
            ).status(),
            403,
        );
        const anon = await browser.newContext();
        assert.equal(
            (
                await anon.request.get(
                    base + "/api/notebook/order?id=" + first.id + "&revision=" + revision,
                )
            ).status(),
            401,
        );
        assert.equal(
            (await anon.request.post(base + "/api/notebook/order", { data: {} })).status(),
            401,
        );
        await anon.close();
        const other = await browser.newContext();
        await signup(other, "notebook-order-tools-other");
        assert.equal(
            (
                await other.request.get(base + "/api/notebook/order?id=" + first.id + "&revision=0")
            ).status(),
            404,
        );
        assert.equal(
            (
                await other.request.get(
                    base + "/api/notebook/order?id=" + first.id + "&revision=0",
                    { headers: { "X-Notebook-User": user.id } },
                )
            ).status(),
            401,
        );
        await other.close();
        pass(
            "Order tools enforce authentication, owner isolation, revision pinning and same-origin writes",
        );
    } catch (error) {
        failure = error;
        const failedPage = browser?.contexts()[0]?.pages()[0];
        if (failedPage) {
            await failedPage
                .screenshot({ path: "verification/order-tools-failure.png", fullPage: true })
                .catch(() => {});
            console.error(
                "Sale picker state",
                await failedPage
                    .locator('[aria-label="Find a sale product"]')
                    .inputValue()
                    .catch(() => null),
                await failedPage
                    .locator("select[name=product]")
                    .evaluate((element) => ({
                        disabled: element.disabled,
                        options: [...element.options].map((option) => option.value),
                    }))
                    .catch(() => null),
                await failedPage
                    .getByRole("status")
                    .allTextContents()
                    .catch(() => []),
            );
        }
        console.error(
            "FAIL",
            String(error.message || error).split("\n")[0],
            typeof error.actual === "number" ||
                (Array.isArray(error.actual) &&
                    error.actual.every((value) => typeof value === "number"))
                ? { actual: error.actual, expected: error.expected }
                : {},
            String(error.stack || "")
                .split("\n")
                .find((line) => line.includes("verify-order-tools.cjs")) || "",
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
            "verification/order-tools-e2e.json",
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
