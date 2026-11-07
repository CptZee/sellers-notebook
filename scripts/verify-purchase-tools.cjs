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
        const user = await signup(context, "notebook-purchase-tools"),
            { createSampleNotebook } = await import("../lib/sample-notebook.mjs"),
            { eligibleFinancialPurchases } = await import("../lib/purchase-payments.mjs"),
            document = createSampleNotebook();
        let response = await context.request.put(base + "/api/notebook", {
            headers: { Origin: base },
            data: { revision: 0, document },
        });
        assert.equal(response.status(), 200, await response.text());
        let revision = (await response.json()).revision;
        const supplier = document.suppliers[1],
            product = document.products.find((p) => supplier.productIds.includes(p.id));
        response = await context.request.get(
            base +
                "/api/notebook/inventory?" +
                new URLSearchParams({
                    revision: String(revision),
                    supplierId: supplier.id,
                    size: "100",
                }),
        );
        assert.equal(response.status(), 200, await response.text());
        assert.deepEqual(
            (await response.json()).items.map((row) => row.product.id),
            document.products.filter((p) => supplier.productIds.includes(p.id)).map((p) => p.id),
        );
        const page = await context.newPage(),
            reads = [],
            writes = [];
        page.on("request", (request) => {
            if (request.method() === "GET") reads.push(request.url());
            if (request.method() === "POST" && request.url().endsWith("/api/notebook/purchase"))
                writes.push(request.postDataJSON());
        });
        await page.goto(base + "/notebook");
        await page.getByText("Live across your devices", { exact: true }).waitFor();
        await page.getByRole("button", { name: "Quick create", exact: true }).click();
        await page
            .getByRole("group", { name: "Create a new entry", exact: true })
            .getByRole("button", { name: "New purchase order", exact: true })
            .click();
        await page.getByRole("dialog", { name: "New purchase order", exact: true }).waitFor();
        await page.getByLabel("Find a purchase supplier", { exact: true }).fill(supplier.email);
        await page.getByLabel("Purchase supplier", { exact: true }).selectOption(supplier.id);
        await page.getByLabel("Find a purchase product", { exact: true }).fill(product.sku);
        await page
            .getByRole("button", { name: `Add ${product.name} · ${product.sku}`, exact: true })
            .click();
        await page.getByLabel("Purchase units 1", { exact: true }).fill("5");
        await page.getByLabel("Purchase unit cost 1", { exact: true }).fill("10");
        await page.getByLabel("Purchase notes", { exact: true }).fill("PRIVATE-PURCHASE-NOTE");
        let failOnce = true;
        await page.route("**/api/notebook/purchase", async (route) => {
            if (route.request().method() === "POST" && failOnce) {
                failOnce = false;
                await route.fulfill({
                    status: 503,
                    contentType: "application/json",
                    body: JSON.stringify({ error: "Temporary purchase test failure" }),
                });
            } else await route.continue();
        });
        await page.getByRole("button", { name: "Save purchase order", exact: true }).click();
        await page.getByText("Temporary purchase test failure", { exact: true }).waitFor();
        assert.equal(await page.getByLabel("Purchase units 1", { exact: true }).inputValue(), "5");
        const draftId = writes.at(-1).id;
        let saved = page.waitForResponse(
            (r) => r.url().endsWith("/api/notebook/purchase") && r.request().method() === "POST",
        );
        await page.getByRole("button", { name: "Save purchase order", exact: true }).click();
        assert.equal((await saved).status(), 200);
        await page
            .getByRole("dialog", { name: "New purchase order", exact: true })
            .waitFor({ state: "hidden" });
        await page.unroute("**/api/notebook/purchase");
        assert.equal(writes.at(-1).id, draftId);
        let after = await (await context.request.get(base + "/api/notebook")).json();
        revision = after.revision;
        let purchase = after.document.purchaseOrders.find((p) => p.id === draftId);
        assert.equal(purchase.items[0].quantity, 5);
        assert.equal(purchase.items[0].unitCost, 10);
        assert.deepEqual(after.document.products, document.products);
        assert.equal(after.document.purchaseOrders.length, 101);
        assert.ok(!reads.some((url) => url.includes("/pages?")));
        pass(
            "FAB purchase creation uses targeted supplier/linked-product pages, retains draft/ID after failure and does not change stock or hydrate collections",
        );
        if (!(await page.locator(".purchase-orders").evaluate((element) => element.open)))
            await page.locator(".purchase-orders > summary").click();
        const row = page.locator(`.purchase-record[data-purchase-id="${draftId}"]`);
        await row.waitFor();
        await row.locator(":scope > summary").click();
        await row.getByRole("button", { name: "Set expected delivery", exact: true }).click();
        await page.getByLabel("Expected delivery date", { exact: true }).fill("2026-12-01");
        saved = page.waitForResponse(
            (r) => r.url().endsWith("/api/notebook/purchase") && r.request().method() === "POST",
        );
        await page.getByRole("button", { name: "Save expected delivery", exact: true }).click();
        assert.equal((await saved).status(), 200);
        await page
            .getByRole("dialog", { name: "Expected delivery", exact: true })
            .waitFor({ state: "hidden" });
        async function confirmAndSave(button) {
            await button.click();
            const dialog = page.getByRole("dialog", { name: "Please confirm", exact: true });
            await dialog.waitFor();
            const saved = page.waitForResponse(
                (r) =>
                    r.url().endsWith("/api/notebook/purchase") && r.request().method() === "POST",
            );
            await dialog.getByRole("button", { name: "Continue", exact: true }).click();
            const response = await saved;
            assert.equal(response.status(), 200, await response.text());
            await page.getByText("Saved to your account", { exact: true }).waitFor();
        }
        await row.locator(".purchase-payments > summary").click();
        await row.getByRole("button", { name: "Record a payment", exact: true }).click();
        await page.getByLabel("Purchase payment amount", { exact: true }).fill("30");
        await page
            .getByLabel("Purchase payment reference", { exact: true })
            .fill("PRIVATE-PAYMENT");
        await confirmAndSave(
            page.getByRole("button", { name: "Save payment record", exact: true }),
        );
        await page
            .getByLabel("Purchase payment amount", { exact: true })
            .waitFor({ state: "hidden" });
        await row.getByRole("button", { name: "Receive part of delivery", exact: true }).click();
        await page.getByLabel(`Received now for ${product.sku}`, { exact: true }).fill("2");
        await confirmAndSave(
            page.getByRole("button", { name: "Record received units", exact: true }),
        );
        await page
            .getByRole("button", { name: "Record received units", exact: true })
            .waitFor({ state: "hidden" });
        await confirmAndSave(row.getByRole("button", { name: "Cancel remainder", exact: true }));
        await row
            .locator(".purchase-payment-summary > div")
            .filter({ hasText: "Credit to review with supplier" })
            .getByText("₱10.00", { exact: true })
            .waitFor();
        after = await (await context.request.get(base + "/api/notebook")).json();
        revision = after.revision;
        purchase = after.document.purchaseOrders.find((p) => p.id === draftId);
        assert.equal(purchase.status, "Cancelled");
        assert.equal(purchase.expectedDate, "2026-12-01");
        assert.equal(purchase.items[0].receivedQuantity, 2);
        assert.equal(
            after.document.products.find((p) => p.id === product.id).stock,
            product.stock + 2,
        );
        assert.equal(after.document.stockAdjustments.length, document.stockAdjustments.length + 1);
        assert.deepEqual(after.document.expenses, document.expenses);
        assert.deepEqual(after.document.orders, document.orders);
        assert.ok(!reads.some((url) => url.includes("/pages?")));
        pass(
            "Expected date, private payment, partial receipt and cancellation update only the purchase, arrived stock and new history atomically",
        );
        await page.getByRole("button", { name: "Quick create", exact: true }).click();
        await page
            .getByRole("group", { name: "Create a new entry", exact: true })
            .getByRole("button", { name: "Supplier refund", exact: true })
            .click();
        await page
            .getByLabel("Find a financial purchase", { exact: true })
            .fill(purchase.reference);
        let failLookup = true;
        await page.route("**/api/notebook/purchase?*", async (route) => {
            if (failLookup) {
                failLookup = false;
                await route.fulfill({
                    status: 503,
                    contentType: "application/json",
                    body: JSON.stringify({ error: "Temporary financial lookup failure" }),
                });
            } else await route.continue();
        });
        await page
            .getByLabel("Purchase for financial entry", { exact: true })
            .selectOption(draftId);
        await page.getByRole("button", { name: "Retry selected purchase", exact: true }).click();
        await page.unroute("**/api/notebook/purchase?*");
        await page.getByLabel("Supplier refund amount", { exact: true }).fill("10");
        await confirmAndSave(
            page.getByRole("button", { name: "Save supplier refund", exact: true }),
        );
        await page
            .getByRole("dialog", { name: "Record supplier refund", exact: true })
            .waitFor({ state: "hidden" });
        after = await (await context.request.get(base + "/api/notebook")).json();
        revision = after.revision;
        purchase = after.document.purchaseOrders.find((p) => p.id === draftId);
        assert.equal(purchase.supplierRefunds[0].amount, 10);
        assert.equal(
            after.document.products.find((p) => p.id === product.id).stock,
            product.stock + 2,
        );
        assert.ok(!reads.some((url) => url.includes("/pages?")));
        pass(
            "Financial FAB lists eligible purchases and records a supplier refund against received credit without loading collections",
        );
        const reopened = page.locator(`.purchase-record[data-purchase-id="${draftId}"]`);
        if (!(await page.locator(".purchase-orders").evaluate((element) => element.open)))
            await page.locator(".purchase-orders > summary").click();
        await reopened.waitFor();
        if (!(await reopened.evaluate((element) => element.open)))
            await reopened.locator(":scope > summary").click();
        if (!(await reopened.locator(".purchase-payments").evaluate((element) => element.open)))
            await reopened.locator(".purchase-payments > summary").click();
        const paymentId = purchase.payments[0].id,
            refundId = purchase.supplierRefunds[0].id;
        await reopened
            .getByRole("button", { name: `Remove payment ${paymentId}`, exact: true })
            .click();
        let dialog = page.getByRole("dialog", { name: "Please confirm", exact: true });
        await dialog.waitFor();
        saved = page.waitForResponse(
            (r) => r.url().endsWith("/api/notebook/purchase") && r.request().method() === "POST",
        );
        await dialog.getByRole("button", { name: "Continue", exact: true }).click();
        assert.equal((await saved).status(), 409);
        await page.getByRole("alert").filter({ hasText: "supports a supplier refund" }).waitFor();
        await reopened.locator(".supplier-refunds > summary").click();
        await confirmAndSave(
            reopened.getByRole("button", {
                name: `Remove supplier refund ${refundId}`,
                exact: true,
            }),
        );
        await reopened
            .getByRole("button", { name: `Remove supplier refund ${refundId}`, exact: true })
            .waitFor({ state: "hidden" });
        await confirmAndSave(
            reopened.getByRole("button", { name: `Remove payment ${paymentId}`, exact: true }),
        );
        after = await (await context.request.get(base + "/api/notebook")).json();
        revision = after.revision;
        purchase = after.document.purchaseOrders.find((p) => p.id === draftId);
        assert.equal(purchase.payments.length, 0);
        assert.equal(purchase.supplierRefunds.length, 0);
        assert.equal(
            after.document.products.find((p) => p.id === product.id).stock,
            product.stock + 2,
        );
        assert.ok(!reads.some((url) => url.includes("/pages?")));
        pass(
            "Supporting payment safeguards reject invalid correction; refund/payment removals reconcile without touching stock",
        );
        for (const kind of ["payment", "supplier-refund"]) {
            const expected = eligibleFinancialPurchases(after.document.purchaseOrders, kind),
                response = await context.request.get(
                    base +
                        "/api/notebook/view?" +
                        new URLSearchParams({
                            kind: "statements",
                            financial: kind,
                            revision: String(revision),
                        }),
                );
            assert.equal(response.status(), 200, await response.text());
            const data = await response.json();
            assert.equal(data.total, expected.length);
            assert.deepEqual(
                data.items.map((p) => p.id),
                expected.slice(0, 25).map((p) => p.id),
            );
        }
        const outstanding = after.document.purchaseOrders.find(
                (p) => p.id === document.purchaseOrders[2].id,
            ),
            beforeConcurrent = after.document.products,
            receive = {
                kind: "receive",
                id: outstanding.id,
                expected: outstanding,
                input: {},
                revision,
            };
        const raced = await Promise.all(
            [0, 1].map(() =>
                context.request.post(base + "/api/notebook/purchase", {
                    headers: { Origin: base },
                    data: receive,
                }),
            ),
        );
        assert.deepEqual(raced.map((r) => r.status()).sort(), [200, 409]);
        after = await (await context.request.get(base + "/api/notebook")).json();
        revision = after.revision;
        assert.equal(
            after.document.purchaseOrders.find((p) => p.id === outstanding.id).status,
            "Received",
        );
        for (const item of outstanding.items)
            assert.equal(
                after.document.products.find((p) => p.id === item.productId).stock,
                beforeConcurrent.find((p) => p.id === item.productId).stock + item.quantity,
            );
        assert.equal(
            (
                await context.request.post(base + "/api/notebook/purchase", {
                    headers: { Origin: base },
                    data: { ...receive, revision },
                })
            ).status(),
            409,
        );
        pass(
            "Eligibility matches financial helpers; concurrent full receipt commits once and stale replay cannot duplicate stock",
        );
        await page.setViewportSize({ width: 1440, height: 1000 });
        for (const width of [320, 390, 768]) {
            await page.setViewportSize({ width, height: 844 });
            await page.getByRole("button", { name: "Quick create", exact: true }).click();
            await page
                .getByRole("group", { name: "Create a new entry", exact: true })
                .getByRole("button", { name: "New purchase order", exact: true })
                .click();
            await page.getByLabel("Purchase supplier", { exact: true }).selectOption(supplier.id);
            await page
                .getByRole("button", { name: `Add ${product.name} · ${product.sku}`, exact: true })
                .click();
            assert.ok(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            );
            await page.getByRole("button", { name: "Cancel purchase entry", exact: true }).click();
        }
        pass("Targeted purchase pickers and line entry fit phone/tablet widths");
        response = await context.request.get(
            base +
                "/api/notebook/purchase?" +
                new URLSearchParams({ id: draftId, revision: String(revision) }),
        );
        assert.equal(response.status(), 200);
        assert.deepEqual(Object.keys(await response.json()).sort(), ["record", "revision"]);
        assert.equal(
            (
                await context.request.get(
                    base + "/api/notebook/purchase?id=" + draftId + "&revision=0",
                )
            ).status(),
            409,
        );
        assert.equal(
            (
                await context.request.get(
                    base + "/api/notebook/purchase?id=missing&revision=" + revision,
                )
            ).status(),
            404,
        );
        const anon = await browser.newContext();
        assert.equal(
            (
                await anon.request.get(
                    base + "/api/notebook/purchase?id=" + draftId + "&revision=" + revision,
                )
            ).status(),
            401,
        );
        assert.equal(
            (await anon.request.post(base + "/api/notebook/purchase", { data: {} })).status(),
            401,
        );
        await anon.close();
        const other = await browser.newContext();
        await signup(other, "notebook-purchase-tools-other");
        assert.equal(
            (
                await other.request.get(
                    base + "/api/notebook/purchase?id=" + draftId + "&revision=0",
                )
            ).status(),
            404,
        );
        assert.equal(
            (
                await other.request.get(
                    base + "/api/notebook/purchase?id=" + draftId + "&revision=0",
                    { headers: { "X-Notebook-User": user.id } },
                )
            ).status(),
            401,
        );
        await other.close();
        assert.equal(
            (
                await context.request.post(base + "/api/notebook/purchase", {
                    headers: { Origin: "https://unrelated.example" },
                    data: {},
                })
            ).status(),
            403,
        );
        pass(
            "Purchase reads/commands enforce individual responses, revision pinning, owner isolation and same-origin writes",
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
                .find((line) => line.includes("verify-purchase-tools.cjs")) || "",
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
            "verification/purchase-tools-e2e.json",
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
