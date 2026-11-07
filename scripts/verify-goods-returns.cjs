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

        const user = await signup(context, "notebook-goods-returns"),
            { createSampleNotebook } = await import("../lib/sample-notebook.mjs"),
            { purchasePaymentSummary } = await import("../lib/purchase-payments.mjs"),
            { createNotebookBackup, readNotebookBackup } =
                await import("../lib/notebook-backup.mjs"),
            { validDocument } = await import("../lib/notebook-validation.mjs");
        const doc = createSampleNotebook(),
            product = doc.products.find((p) => p.stock >= 5),
            supplier = doc.suppliers[0],
            date = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
        const po = {
            id: crypto.randomUUID(),
            reference: "RETURN-QA",
            supplierId: supplier.id,
            supplierName: supplier.name,
            status: "Received",
            createdAt: new Date().toISOString(),
            receivedAt: new Date().toISOString(),
            expectedDate: "",
            notes: "PRIVATE-PO",
            items: [
                {
                    productId: product.id,
                    productName: product.name,
                    sku: product.sku,
                    quantity: 5,
                    receivedQuantity: 5,
                    unitCost: 100,
                },
            ],
            payments: [
                {
                    id: crypto.randomUUID(),
                    date,
                    amount: 500,
                    method: "Cash",
                    reference: "",
                    notes: "",
                },
            ],
            supplierRefunds: [],
        };
        doc.purchaseOrders = [po];
        let response = await context.request.put(base + "/api/notebook", {
            headers: { Origin: base },
            data: { revision: 0, document: doc },
        });
        assert.equal(response.status(), 200, await response.text());
        const snapshot = async () =>
            await (await context.request.get(base + "/api/notebook")).json();
        async function command(kind, input, entryId = crypto.randomUUID(), expected) {
            const current = await snapshot();
            return context.request.post(base + "/api/notebook/purchase", {
                headers: { Origin: base },
                data: {
                    kind,
                    id: po.id,
                    input,
                    entryId,
                    expected: expected || current.document.purchaseOrders[0],
                    revision: current.revision,
                },
            });
        }
        response = await command("goods-return", {
            items: [{ productId: product.id, quantity: 2 }],
            date,
            reason: "PRIVATE-RETURN",
        });
        assert.equal(response.status(), 200, await response.text());
        let current = await snapshot(),
            purchase = current.document.purchaseOrders[0];
        assert.equal(
            current.document.products.find((p) => p.id === product.id).stock,
            product.stock - 2,
        );
        assert.equal(purchase.items[0].receivedQuantity, 5);
        assert.equal(purchasePaymentSummary(purchase).credit, 200);
        assert.ok(validDocument(current.document));
        assert.deepEqual(
            readNotebookBackup(createNotebookBackup(current.document)).document,
            current.document,
        );
        pass(
            "Atomic return changes stock once, preserves gross receipts, validates audit links and round-trips backup",
        );
        response = await context.request.get(
            base +
                "/api/notebook/view?" +
                new URLSearchParams({ kind: "statements", revision: String(current.revision) }),
        );
        assert.equal(response.status(), 200, await response.text());
        let statement = await response.json();
        assert.equal(statement.totals.credit, 200);
        assert.equal(statement.totals.itemTotal, 300);
        const copy = await context.request.get(
            base +
                "/api/notebook/copy?" +
                new URLSearchParams({
                    kind: "purchase",
                    id: po.id,
                    revision: String(current.revision),
                }),
        );
        assert.equal(copy.status(), 200, await copy.text());
        assert.ok(!(await copy.text()).includes("PRIVATE-RETURN"));
        assert.ok((await copy.text()).includes("units returned"));
        pass("SQL statement totals and private supplier copy agree with returned item credit");
        response = await command("goods-return-refund", {
            amount: 100,
            date,
            method: "Cash",
            notes: "PRIVATE-CASH",
        });
        assert.equal(response.status(), 200, await response.text());
        current = await snapshot();
        purchase = current.document.purchaseOrders[0];
        assert.equal(purchasePaymentSummary(purchase).credit, 100);
        assert.equal(
            (await command("goods-return-refund", { amount: 101, date, method: "Cash" })).status(),
            409,
        );
        assert.equal(
            (
                await command("void-goods-return", { returnId: purchase.goodsReturns[0].id })
            ).status(),
            409,
        );
        response = await command("remove-goods-return-refund", {
            recordId: purchase.goodsReturnRefunds[0].id,
        });
        assert.equal(response.status(), 200, await response.text());
        const stale = purchase;
        response = await command("void-goods-return", { returnId: purchase.goodsReturns[0].id });
        assert.equal(response.status(), 200, await response.text());
        current = await snapshot();
        assert.equal(
            current.document.products.find((p) => p.id === product.id).stock,
            product.stock,
        );
        assert.equal(current.document.stockAdjustments.length, doc.stockAdjustments.length + 2);
        assert.ok(validDocument(current.document));
        assert.equal(
            (
                await command(
                    "goods-return",
                    { items: [{ productId: product.id, quantity: 1 }], date, reason: "stale" },
                    crypto.randomUUID(),
                    stale,
                )
            ).status(),
            409,
        );
        pass(
            "Cash limits, supporting-refund void guard, corrections and stale entries enforce reconciliation",
        );
        const page = await context.newPage(),
            reads = [];
        page.on("request", (r) => {
            if (r.method() === "GET") reads.push(r.url());
        });
        await page.goto(base + "/notebook");
        await page.getByText("Live across your devices", { exact: true }).waitFor();
        await page
            .locator("#notebook-sidebar nav")
            .getByRole("button", { name: /^Suppliers/ })
            .click();
        await page.locator(".purchase-orders > summary").click();
        const row = page.locator(".purchase-record").filter({ hasText: "RETURN-QA" });
        await row.locator(":scope > summary").click();
        await row.locator(".supplier-goods-returns > summary").click();
        await row.getByRole("button", { name: "Return received goods", exact: true }).click();
        await page.getByLabel("Return units for " + product.sku, { exact: true }).fill("1");
        await page.getByLabel("Reason for supplier return", { exact: true }).fill("Browser return");
        let once = true;
        await page.route("**/api/notebook/purchase", async (route) => {
            if (route.request().method() === "POST" && once) {
                once = false;
                await route.fulfill({
                    status: 503,
                    contentType: "application/json",
                    body: JSON.stringify({ error: "Return retry test" }),
                });
            } else await route.continue();
        });
        async function save() {
            await page.getByRole("button", { name: "Record physical return", exact: true }).click();
            const dialog = page.getByRole("dialog", { name: "Please confirm", exact: true });
            await dialog.waitFor();
            const pending = page.waitForResponse(
                (r) =>
                    r.url().endsWith("/api/notebook/purchase") && r.request().method() === "POST",
            );
            await dialog.getByRole("button", { name: "Continue", exact: true }).click();
            return pending;
        }
        assert.equal((await save()).status(), 503);
        await page.getByText("Return retry test", { exact: true }).waitFor();
        assert.equal(
            await page.getByLabel("Reason for supplier return", { exact: true }).inputValue(),
            "Browser return",
        );
        assert.equal((await save()).status(), 200);
        await page
            .getByRole("dialog", { name: "Return goods to supplier", exact: true })
            .waitFor({ state: "hidden" });
        assert.ok(!reads.some((url) => url.includes("/pages?")));
        for (const width of [320, 390, 768]) {
            await page.setViewportSize({ width, height: 844 });
            assert.ok(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            );
        }
        pass(
            "Return modal saves without hydration, retains failed draft, and fits phone/tablet widths",
        );
        const anon = await browser.newContext();
        assert.equal(
            (await anon.request.post(base + "/api/notebook/purchase", { data: {} })).status(),
            401,
        );
        await anon.close();
        pass("Return commands require authentication");
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
                .find((line) => line.includes("verify-goods-returns.cjs")) || "",
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
            "verification/goods-returns-e2e.json",
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
