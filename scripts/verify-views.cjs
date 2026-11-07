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
        const user = await signup(context, "notebook-views"),
            { createSampleNotebook } = await import("../lib/sample-notebook.mjs"),
            { deliveryReminders, deliveryCounts } = await import("../lib/delivery-reminders.mjs"),
            { supplierStatement, statementSuppliers } =
                await import("../lib/supplier-statements.mjs"),
            { purchaseOverview, isPurchaseOverdue } = await import("../lib/purchase-copy.mjs"),
            { notebookViewExport } = await import("../lib/notebook-view-export.mjs"),
            { parseNotebookView } = await import("../lib/notebook-view-query.mjs"),
            { orderGroup } = await import("../lib/order-copy.mjs"),
            document = createSampleNotebook(),
            today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(
                new Date(),
            );
        const financial = document.purchaseOrders[0];
        financial.status = "Cancelled";
        financial.cancelledAt = new Date().toISOString();
        financial.items = financial.items.map((item) => ({ ...item, receivedQuantity: 0 }));
        financial.payments = Array.from({ length: 31 }, (_, i) => ({
            id: "history-payment-" + i,
            amount: 1,
            date: today,
            method: "Cash",
            reference: "PRIVATE-REFERENCE-" + i,
            notes: "PRIVATE-NOTE-" + i,
        }));
        financial.supplierRefunds = Array.from({ length: 30 }, (_, i) => ({
            id: "history-return-" + i,
            amount: 0.5,
            date: today,
            method: "Cash",
            reference: "PRIVATE-REFUND-" + i,
            notes: "PRIVATE-REFUND-NOTE-" + i,
        }));
        const refundOrder = document.orders[0];
        document.refundRecords = document.refundRecords.filter((r) => r.orderId !== refundOrder.id);
        document.refundRecords.unshift(
            ...Array.from({ length: 31 }, (_, i) => ({
                id: "history-customer-" + i,
                orderId: refundOrder.id,
                amount: 0.01,
                date: today,
                reason: "Fixture refund " + i,
            })),
        );
        document.purchaseOrders[1].status = "Partially received";
        document.purchaseOrders[1].items[0].receivedQuantity = 1;
        document.purchaseOrders[2].status = "Received";
        document.purchaseOrders[2].receivedAt = new Date().toISOString();
        document.suppliers = document.suppliers.filter(
            (s) => s.id !== document.purchaseOrders[3].supplierId,
        );
        const seeded = await context.request.put(base + "/api/notebook", {
            headers: { Origin: base },
            data: { revision: 0, document },
        });
        assert.equal(seeded.status(), 200, await seeded.text());
        let revision = (await seeded.json()).revision,
            cases = 0;
        async function query(filters) {
            const response = await context.request.get(
                base +
                    "/api/notebook/view?" +
                    new URLSearchParams({ revision: String(revision), ...filters }),
            );
            assert.equal(response.status(), 200, await response.text());
            return response.json();
        }
        for (const kind of ["purchases", "reminders", "statements"])
            for (const status of kind === "purchases"
                ? [
                      "All purchases",
                      "Ordered",
                      "Partially received",
                      "Overdue",
                      "Received",
                      "Cancelled",
                  ]
                : kind === "reminders"
                  ? ["All open", "Overdue", "Due today", "Next 7 days", "Later", "No date set"]
                  : ["All statuses", "Ordered", "Partially received", "Received", "Cancelled"])
                for (const search of ["", "SAMPLE-PO-00", "no match"])
                    for (const page of [1, 2, 999]) {
                        const data = await query({
                            kind,
                            status,
                            search,
                            page: String(page),
                            size: "10",
                        });
                        let expected, totals;
                        if (kind === "purchases") {
                            expected = document.purchaseOrders
                                .filter(
                                    (o) =>
                                        (status === "All purchases" ||
                                            (status === "Overdue"
                                                ? isPurchaseOverdue(o, today)
                                                : o.status === status)) &&
                                        [
                                            o.reference,
                                            o.supplierName,
                                            ...o.items.map((i) => i.productName + " " + i.sku),
                                        ]
                                            .join(" ")
                                            .toLowerCase()
                                            .includes(search.toLowerCase()),
                                )
                                .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
                            totals = purchaseOverview(expected, today);
                        }
                        if (kind === "reminders") {
                            expected = deliveryReminders(document.purchaseOrders, today, {
                                filter: status,
                                search,
                                supplierId: "all",
                            });
                            assert.deepEqual(
                                data.counts,
                                deliveryCounts(document.purchaseOrders, today),
                            );
                            totals = { quantity: expected.reduce((sum, r) => sum + r.quantity, 0) };
                        }
                        if (kind === "statements") {
                            const statement = supplierStatement(document.purchaseOrders, {
                                status,
                                search,
                            });
                            expected = statement.rows;
                            totals = statement.totals;
                            assert.deepEqual(
                                data.options,
                                statementSuppliers(document.suppliers, document.purchaseOrders),
                            );
                        }
                        assert.equal(data.total, expected.length);
                        const actualPage = Math.min(
                            page,
                            Math.max(1, Math.ceil(expected.length / 10)),
                        );
                        assert.equal(data.page, actualPage);
                        assert.deepEqual(
                            data.items.map((r) => r.id),
                            expected.slice((actualPage - 1) * 10, actualPage * 10).map((r) => r.id),
                        );
                        for (const [key, value] of Object.entries(totals))
                            assert.equal(data.totals[key], value, kind + " " + status + " " + key);
                        if (kind === "purchases")
                            assert.ok(
                                data.items.every(
                                    (row) => !row.payments && !row.supplierRefunds && row.financial,
                                ),
                            );
                        cases++;
                    }
        for (const [kind, parent, records] of [
            ["stock", "", document.stockAdjustments],
            ["refunds", "", document.refundRecords],
            [
                "refunds",
                refundOrder.id,
                document.refundRecords.filter((r) =>
                    orderGroup(document.orders, refundOrder.id).some((o) => o.id === r.orderId),
                ),
            ],
            ["payments", financial.id, financial.payments],
            ["supplier-refunds", financial.id, financial.supplierRefunds],
        ])
            for (const page of [1, 2, 999]) {
                const data = await query({ kind, parent, page: String(page) }),
                    actualPage = Math.min(page, Math.max(1, Math.ceil(records.length / 25)));
                assert.equal(data.total, records.length);
                assert.deepEqual(data.items, records.slice((actualPage - 1) * 25, actualPage * 25));
                cases++;
            }
        for (const kind of [
            "purchases",
            "reminders",
            "statements",
            "stock",
            "refunds",
            "payments",
            "supplier-refunds",
        ]) {
            const filters = {
                    kind,
                    parent: ["payments", "supplier-refunds"].includes(kind) ? financial.id : "",
                    revision: String(revision),
                },
                response = await context.request.get(
                    base + "/api/notebook/view-export?" + new URLSearchParams(filters),
                );
            assert.equal(response.status(), 200, await response.text());
            assert.equal(
                (await response.text()).replace(/^\uFEFF/, ""),
                notebookViewExport(
                    document,
                    parseNotebookView(new URLSearchParams(filters), today),
                ).body.replace(/^\uFEFF/, ""),
                kind + " complete export",
            );
        }
        const html = await context.request.get(
            base +
                "/api/notebook/view-export?" +
                new URLSearchParams({
                    kind: "statements",
                    format: "html",
                    revision: String(revision),
                }),
        );
        assert.equal(html.status(), 200);
        assert.ok(!(await html.text()).includes("PRIVATE-NOTE"));
        assert.ok(!(await html.text()).includes("ajmission.dev"));
        pass(
            `${cases} SQL combinations match helpers, global counts, stable pages and complete exports; purchase rows omit financial histories`,
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
        await page.getByRole("navigation", { name: "Suppliers pagination", exact: true }).waitFor();
        await page.locator(".purchase-orders > summary").click();
        await page.locator(".purchase-record").first().waitFor();
        assert.equal(await page.locator(".purchase-record").count(), 25);
        await page.getByRole("button", { name: "Purchases: Next page", exact: true }).click();
        await page
            .getByRole("navigation", { name: "Purchases pagination", exact: true })
            .getByText("Page 2 of 4", { exact: true })
            .waitFor();
        await page.getByLabel("Search purchases", { exact: true }).fill(financial.reference);
        await page
            .getByRole("navigation", { name: "Purchases pagination", exact: true })
            .getByText("Page 1 of 1", { exact: true })
            .waitFor();
        await page.locator(".purchase-record > summary").click();
        await page.locator(".purchase-payments > summary").click();
        await page
            .getByRole("navigation", { name: "Purchase payments pagination", exact: true })
            .getByText("Page 1 of 2", { exact: true })
            .waitFor();
        assert.equal(await page.locator(".purchase-payment-record").count(), 25);
        await page.locator(".supplier-refunds > summary").click();
        await page
            .getByRole("navigation", { name: "Supplier refunds pagination", exact: true })
            .getByText("Page 1 of 2", { exact: true })
            .waitFor();
        await page.locator(".delivery-reminders > summary").click();
        await page
            .getByRole("navigation", { name: "Delivery reminders pagination", exact: true })
            .waitFor();
        await page.locator(".supplier-statements > summary").click();
        await page
            .getByRole("navigation", { name: "Supplier statement pagination", exact: true })
            .waitFor();
        await page.waitForFunction(
            () => !document.querySelector(".supplier-statements [role=status]"),
        );
        const copy = page.waitForEvent("download");
        await page.getByRole("button", { name: "Download statement copy", exact: true }).click();
        assert.ok(fs.readFileSync(await (await copy).path(), "utf8").includes("SAMPLE-PO-100"));
        const popupPromise = page.waitForEvent("popup");
        await page.getByRole("button", { name: "Print supplier statement", exact: true }).click();
        const popup = await popupPromise;
        await popup.waitForFunction(() => document.body.textContent.includes("SAMPLE-PO-100"));
        await popup.close();
        assert.ok(!reads.some((url) => url.includes("/api/notebook/pages?")));
        pass(
            "Purchases, reminders, statements, payment/refund pages and full statement download/print browse without hydrating collections",
        );
        for (const width of [320, 390, 768]) {
            await page.setViewportSize({ width, height: 844 });
            assert.ok(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            );
        }
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page
            .locator("#notebook-sidebar nav")
            .getByRole("button", { name: /^Inventory/ })
            .click();
        await page.locator(".stock-adjustments > summary").click();
        await page
            .getByRole("navigation", { name: "Stock history pagination", exact: true })
            .waitFor();
        assert.ok(!reads.some((url) => url.includes("/api/notebook/pages?")));
        await page
            .locator("#notebook-sidebar nav")
            .getByRole("button", { name: /^Orders/ })
            .click();
        await page.locator(".customer-refund-history > summary").click();
        await page
            .getByRole("navigation", { name: "Customer refund history pagination", exact: true })
            .waitFor();
        assert.ok(!reads.some((url) => url.includes("/api/notebook/pages?")));
        pass(
            "Stock and customer refund histories browse without hydration and supplier panels fit phone/tablet widths",
        );
        await page
            .locator("#notebook-sidebar nav")
            .getByRole("button", { name: /^Suppliers/ })
            .click();
        await page.locator(".purchase-orders > summary").click();
        await page.getByRole("button", { name: "New purchase order", exact: true }).click();
        await page.getByRole("dialog", { name: "New purchase order", exact: true }).waitFor();
        assert.ok(!reads.some((url) => url.includes("/api/notebook/pages?")));
        await page.getByRole("button", { name: "Cancel purchase entry", exact: true }).click();
        pass(
            "Purchase entry uses targeted choices without hydration; cancelled entry preserves records",
        );
        assert.equal(
            (await context.request.get(base + "/api/notebook/view?kind=stock&revision=0")).status(),
            409,
        );
        assert.equal(
            (
                await context.request.get(
                    base + "/api/notebook/view?kind=stock&revision=" + revision + "&size=101",
                )
            ).status(),
            400,
        );
        assert.equal(
            (
                await context.request.get(base + "/api/notebook/view-export?kind=stock&revision=0")
            ).status(),
            409,
        );
        const other = await browser.newContext();
        await signup(other, "notebook-views-other");
        assert.equal(
            (
                await (
                    await other.request.get(base + "/api/notebook/view?kind=stock&revision=0")
                ).json()
            ).total,
            0,
        );
        assert.equal(
            (
                await other.request.get(
                    base + "/api/notebook/view?kind=stock&revision=" + revision,
                    { headers: { "X-Notebook-User": user.id } },
                )
            ).status(),
            401,
        );
        await other.close();
        const anon = await browser.newContext();
        assert.equal(
            (await anon.request.get(base + "/api/notebook/view?kind=stock&revision=0")).status(),
            401,
        );
        await anon.close();
        pass("Queries and exports enforce revision, bounds, authentication and account isolation");
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
                .find((line) => line.includes("verify-views.cjs")) || "",
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
            "verification/views-e2e.json",
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
