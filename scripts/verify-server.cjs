const { chromium } = require("@playwright/test"),
    assert = require("node:assert/strict"),
    crypto = require("node:crypto"),
    fs = require("node:fs"),
    path = require("node:path");
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
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
        async function signup(ctx, prefix) {
            const page = await ctx.newPage();
            await page.goto(base + "/auth/sign-up");
            await page.getByLabel("Your name").fill("Server workflow review");
            await page.getByLabel("Email address").fill(`${prefix}-${Date.now()}@example.com`);
            const password = crypto.randomBytes(24).toString("base64url");
            await page.getByLabel("Password", { exact: true }).fill(password);
            await page.getByLabel("Confirm password", { exact: true }).fill(password);
            await page.getByRole("button", { name: "Create account", exact: true }).click();
            await page.waitForURL(base + "/notebook");
            const manifest = await (await ctx.request.get(base + "/api/notebook/manifest")).json();
            users.push(manifest.user.id);
            await page.close();
            return manifest.user;
        }
        const user = await signup(context, "notebook-server");
        const { createSampleNotebook } = await import("../lib/sample-notebook.mjs"),
            { profitSummary } = await import("../lib/expenses.mjs"),
            { reportRange, inReportRange, revenueBuckets } = await import("../lib/reporting.mjs"),
            { createNotebookPatch } = await import("../lib/notebook-patch.mjs");
        const document = createSampleNotebook(),
            today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(
                new Date(),
            );
        const tomorrow = new Date(Date.parse(today + "T12:00:00Z") + 86400000)
                .toISOString()
                .slice(0, 10),
            edge = {
                id: "server-rounding",
                productId: document.products[0].id,
                productName: document.products[0].name,
                customer: "Rounding fixture",
                channel: "Direct",
                quantity: 3,
                price: 0.1,
                cost: 0.03,
                fee: 12.345,
                packaging: 0.005,
                shipping: 0.02,
                date: today,
                status: "Completed",
                stockApplied: false,
            };
        document.orders.push(edge, { ...edge, id: "server-future", date: tomorrow, price: 100 });
        document.expenses.push({
            id: "server-future-expense",
            title: "Future fixture",
            category: "Other",
            amount: 1,
            date: tomorrow,
            channel: "Business",
            notes: "",
        });
        const oldOrder = document.orders.find(
            (order) => order.status === "Completed" && order.date < today.slice(0, 7) + "-01",
        );
        document.refundRecords.push({
            id: "server-old-sale-refund",
            orderId: oldOrder.id,
            amount: 0.01,
            date: today,
            reason: "Refund uses its own period",
        });
        const seeded = await context.request.put(base + "/api/notebook", {
            headers: { Origin: base },
            data: { revision: 0, document },
        });
        assert.equal(seeded.status(), 200, await seeded.text());
        let revision = (await seeded.json()).revision;
        let compared = 0;
        for (const period of ["7", "30", "90", "month", "all", "custom"])
            for (const channel of ["All channels", "Shopee", "Lazada", "TikTok Shop", "Direct"]) {
                const from = today.slice(0, 7) + "-01",
                    to = today,
                    range = reportRange(
                        period,
                        today,
                        [...document.orders, ...document.expenses, ...document.refundRecords].map(
                            (row) => row.date,
                        ),
                        from,
                        to,
                    );
                const orders = document.orders.filter(
                        (row) =>
                            inReportRange(row.date, range) &&
                            (channel === "All channels" || row.channel === channel),
                    ),
                    expenses = document.expenses.filter(
                        (row) =>
                            inReportRange(row.date, range) &&
                            (channel === "All channels" || row.channel === channel),
                    ),
                    refunds = document.refundRecords.filter(
                        (row) =>
                            inReportRange(row.date, range) &&
                            (channel === "All channels" ||
                                document.orders.find((order) => order.id === row.orderId)
                                    ?.channel === channel),
                    );
                const params = new URLSearchParams({
                        period,
                        channel,
                        from,
                        to,
                        revision: String(revision),
                    }),
                    response = await context.request.get(base + "/api/notebook/report?" + params);
                assert.equal(response.status(), 200, await response.text());
                const report = await response.json();
                assert.deepEqual(report.range, range);
                assert.deepEqual(report.summary, profitSummary(orders, expenses, refunds));
                assert.deepEqual(report.chart, revenueBuckets(orders, range));
                assert.equal(
                    report.refunds,
                    refunds.reduce((n, r) => n + Math.round(r.amount * 100), 0) / 100,
                );
                assert.equal(
                    report.counts.completed,
                    orders.filter((row) => row.status === "Completed").length,
                );
                assert.equal(
                    report.counts.received,
                    orders.filter((row) => row.status !== "Cancelled").length,
                );
                assert.deepEqual(report.recentOrders, orders.slice(0, 5));
                assert.equal(
                    report.inventory.units,
                    document.products.reduce((n, p) => n + p.stock, 0),
                );
                assert.ok(
                    Math.abs(
                        report.inventory.value -
                            document.products.reduce((n, p) => n + p.stock * p.cost, 0),
                    ) < 0.0001,
                );
                assert.deepEqual(
                    report.lowProducts,
                    document.products.filter((p) => p.stock <= (p.reorderPoint ?? 10)).slice(0, 3),
                );
                for (const c of ["Shopee", "Lazada", "TikTok Shop", "Direct"])
                    assert.equal(
                        report.channels[c],
                        orders
                            .filter((row) => row.status === "Completed" && row.channel === c)
                            .reduce((n, row) => n + Math.round(row.price * row.quantity * 100), 0) /
                            100,
                    );
                assert.ok(report.lowProducts.length <= 3);
                assert.ok(report.recentOrders.length <= 5);
                compared++;
            }
        metrics.reportCases = compared;
        pass(
            "SQL reports match existing totals, cents, channels, refunds, chart buckets and recent orders for 30 period/channel combinations",
        );
        const next = structuredClone(document),
            saleProduct = next.products.find((product) => product.stock > 0);
        saleProduct.stock--;
        next.orders.unshift({
            id: "server-record-sale",
            productId: saleProduct.id,
            productName: saleProduct.name,
            quantity: 1,
            status: "Processing",
            date: today,
            price: saleProduct.price,
            cost: saleProduct.cost,
            customer: "Atomic save review",
            channel: "Direct",
            fee: 0,
            packaging: 15,
            shipping: 0,
        });
        const changes = createNotebookPatch(document, next),
            payload = { revision, changes };
        metrics.recordSaveBytes = Buffer.byteLength(JSON.stringify(payload));
        metrics.fullSnapshotBytes = Buffer.byteLength(JSON.stringify(document));
        assert.ok(metrics.recordSaveBytes < metrics.fullSnapshotBytes / 20);
        const saved = await context.request.patch(base + "/api/notebook", {
            headers: { Origin: base, "X-Notebook-User": user.id },
            data: payload,
        });
        assert.equal(saved.status(), 200, await saved.text());
        revision = (await saved.json()).revision;
        const state = await (await context.request.get(base + "/api/notebook")).json();
        assert.deepEqual(state.document, next);
        const invalid = await context.request.patch(base + "/api/notebook", {
            headers: { Origin: base },
            data: {
                revision,
                changes: { products: { remove: [next.products[0].id], upsert: [] } },
            },
        });
        assert.equal(invalid.status(), 400);
        assert.equal(
            (await (await context.request.get(base + "/api/notebook")).json()).revision,
            revision,
        );
        assert.equal(
            (
                await context.request.patch(base + "/api/notebook", {
                    headers: { Origin: base },
                    data: payload,
                })
            ).status(),
            409,
        );
        assert.equal(
            (
                await context.request.patch(base + "/api/notebook", {
                    headers: { Origin: "https://unrelated.example" },
                    data: { revision, changes: { sidebarNote: "Bad origin" } },
                })
            ).status(),
            403,
        );
        assert.equal(
            (
                await context.request.patch(base + "/api/notebook", {
                    headers: { Origin: base, "X-Notebook-User": "wrong-user" },
                    data: { revision, changes: { sidebarNote: "Wrong user" } },
                })
            ).status(),
            401,
        );
        pass(
            "Small record batches atomically save an order and stock, preserve untouched records, and reject invalid links, stale writes, wrong accounts and origins",
        );
        const race = await Promise.all(
            ["First", "Second"].map((sidebarNote) =>
                context.request.patch(base + "/api/notebook", {
                    headers: { Origin: base },
                    data: { revision, changes: { sidebarNote } },
                }),
            ),
        );
        assert.deepEqual(race.map((r) => r.status()).sort(), [200, 409]);
        revision = (await (await context.request.get(base + "/api/notebook")).json()).revision;
        assert.equal(
            (
                await context.request.get(base + "/api/notebook/report?revision=" + (revision - 1))
            ).status(),
            409,
        );
        for (const query of [
            "period=invalid",
            "channel=Unknown",
            "period=custom&from=2026-02-30&to=" + today,
        ])
            assert.equal(
                (await context.request.get(base + "/api/notebook/report?" + query)).status(),
                400,
            );
        pass(
            "Concurrent record saves commit once and reports reject stale revisions and invalid filters",
        );
        const page = await context.newPage();
        let failOnce = true;
        await page.route("**/api/notebook/report?*", (route) => {
            if (failOnce) {
                failOnce = false;
                return route.fulfill({
                    status: 503,
                    contentType: "application/json",
                    body: JSON.stringify({ error: "Report retry review" }),
                });
            }
            return route.continue();
        });
        await page.goto(base + "/notebook");
        await page.getByRole("button", { name: "Retry report", exact: true }).waitFor();
        assert.equal(
            await page.getByRole("button", { name: "Export summary", exact: true }).isDisabled(),
            true,
        );
        await page.getByRole("button", { name: "Retry report", exact: true }).click();
        await page
            .locator(".stat-label")
            .filter({ hasText: /^Total revenue$/ })
            .waitFor();
        const patchResponse = page.waitForResponse(
            (r) => r.url().endsWith("/api/notebook") && r.request().method() === "PATCH",
        );
        await page.getByLabel("A note to yourself", { exact: true }).fill("Browser record delta");
        const browserSave = await patchResponse;
        assert.equal(browserSave.status(), 200, await browserSave.text());
        const body = browserSave.request().postDataJSON();
        assert.deepEqual(Object.keys(body.changes), ["sidebarNote"]);
        assert.equal(body.document, undefined);
        metrics.browserNoteSaveBytes = Buffer.byteLength(browserSave.request().postData());
        await page.getByRole("button", { name: "Export summary", exact: true }).waitFor();
        await page.waitForFunction(() =>
            [...document.querySelectorAll("button")].some(
                (button) => button.textContent === "Export summary" && !button.disabled,
            ),
        );
        const activeReport = await (
            await context.request.get(base + "/api/notebook/report?period=30")
        ).json();
        await page
            .locator("#notebook-sidebar nav")
            .getByRole("button", { name: /^Orders/ })
            .click();
        const revenueCard = page
            .locator(".stat")
            .filter({ has: page.locator(".stat-label").filter({ hasText: /^Revenue$/ }) });
        await revenueCard.locator(".stat-value").waitFor();
        assert.equal(
            await revenueCard.locator(".stat-value").innerText(),
            new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
                activeReport.summary.revenue,
            ),
        );
        pass(
            "Actual dashboard retries failed SQL reports, disables stale exports and uses PATCH with only the changed note",
        );
        const other = await browser.newContext();
        await signup(other, "notebook-server-other");
        const otherReport = await (await other.request.get(base + "/api/notebook/report")).json();
        assert.equal(otherReport.summary.revenue, 0);
        assert.equal(otherReport.inventory.products, 0);
        assert.equal(
            (
                await other.request.get(base + "/api/notebook/report", {
                    headers: { "X-Notebook-User": user.id },
                })
            ).status(),
            401,
        );
        await other.close();
        const anon = await browser.newContext();
        assert.equal((await anon.request.get(base + "/api/notebook/report")).status(), 401);
        assert.equal(
            (
                await anon.request.patch(base + "/api/notebook", {
                    headers: { Origin: base },
                    data: { revision, changes: { sidebarNote: "Anon" } },
                })
            ).status(),
            401,
        );
        await anon.close();
        pass("Reports and record saves isolate real accounts and reject anonymous access");
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
                console.error("Cleanup failed", error.message);
            }
        }
        fs.writeFileSync(
            "verification/server-e2e.json",
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
