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
        const user = await signup(context, "notebook-server-copies"),
            { createSampleNotebook } = await import("../lib/sample-notebook.mjs"),
            document = createSampleNotebook();
        document.branding = {
            businessName: "Copies <script>private()</script>",
            notebookTitle: "Copies notebook",
            tagline: "A branded copy",
            icon: "notebook",
        };
        document.purchaseOrders[0].notes = "PRIVATE-PO-NOTE";
        document.purchaseOrders[0].payments[0].reference = "PRIVATE-BANK-REFERENCE";
        document.purchaseOrders[0].payments[0].notes = "PRIVATE-PAYMENT-NOTE";
        document.refundRecords[0].reason = "PRIVATE-REFUND-REASON";
        let response = await context.request.put(base + "/api/notebook", {
            headers: { Origin: base },
            data: { revision: 0, document },
        });
        assert.equal(response.status(), 200, await response.text());
        let revision = (await response.json()).revision;
        context.setDefaultTimeout(15000);
        const { customerOrderHtml, orderGroup } = await import("../lib/order-copy.mjs"),
            { purchaseCopyHtml } = await import("../lib/purchase-copy.mjs");
        const copyUrl = (kind, id, rev = revision) =>
                base +
                "/api/notebook/copy?" +
                new URLSearchParams({ kind, id, revision: String(rev) }),
            order = document.orders[0],
            purchase = document.purchaseOrders[0];
        for (const [kind, id, expected] of [
            [
                "customer",
                order.id,
                customerOrderHtml(
                    orderGroup(document.orders, order.id),
                    document.branding,
                    document.refundRecords,
                ),
            ],
            ["purchase", purchase.id, purchaseCopyHtml(purchase, document.branding)],
        ]) {
            const r = await context.request.get(copyUrl(kind, id));
            assert.equal(r.status(), 200, await r.text());
            const body = await r.text();
            assert.equal(body, expected);
            for (const secret of [
                "PRIVATE-PO-NOTE",
                "PRIVATE-BANK-REFERENCE",
                "PRIVATE-PAYMENT-NOTE",
                "PRIVATE-REFUND-REASON",
                "Aaron James R. Mission",
                "<script>",
            ])
                assert.ok(!body.includes(secret));
            assert.equal(r.headers()["x-notebook-revision"], String(revision));
            assert.equal(r.headers()["cache-control"], "no-store");
        }
        pass(
            "Server customer/purchase HTML matches existing copy helpers, uses current branding and excludes private bookkeeping, active markup and maker credits",
        );
        const params = new URLSearchParams({
                period: "all",
                channel: "Shopee",
                revision: String(revision),
            }),
            report = await (
                await context.request.get(base + "/api/notebook/report?" + params)
            ).json(),
            csv = await context.request.get(base + "/api/notebook/summary?" + params);
        assert.equal(csv.status(), 200);
        const Papa = require("papaparse"),
            values = new Map(Papa.parse(await csv.text()).data);
        assert.equal(Number(values.get("Revenue")), report.summary.revenue);
        assert.equal(Number(values.get("Recorded refunds")), report.refunds);
        assert.equal(Number(values.get("Estimated net profit")), report.summary.netProfit);
        assert.equal(values.get("Business"), document.branding.businessName);
        pass("Server summary CSV matches SQL reports and saved branding for filtered totals");
        const page = await context.newPage(),
            reads = [];
        page.on("request", (r) => {
            if (r.method() === "GET") reads.push(r.url());
        });
        await page.goto(base + "/notebook");
        const summaryDownload = page.waitForEvent("download");
        await page.getByRole("button", { name: "Export summary", exact: true }).click();
        assert.ok((await summaryDownload).suggestedFilename().startsWith("business-summary-"));
        assert.ok(reads.some((url) => url.includes("/api/notebook/summary?")));
        await page
            .locator("#notebook-sidebar nav")
            .getByRole("button", { name: /^Orders/ })
            .click();
        await page
            .getByRole("button", { name: /^Details for / })
            .first()
            .click();
        await page.getByRole("dialog", { name: "Order details", exact: true }).waitFor();
        const customerDownload = page.waitForEvent("download");
        await page.getByRole("button", { name: "Download customer copy", exact: true }).click();
        assert.ok((await customerDownload).suggestedFilename().startsWith("customer-order-"));
        const popupEvent = page.waitForEvent("popup");
        await page.getByRole("button", { name: "Print customer copy", exact: true }).click();
        const popup = await popupEvent;
        await popup
            .getByRole("heading", { name: document.branding.businessName, exact: true })
            .waitFor();
        await popup.close();
        await page.evaluate(() => {
            window.__savedOpen = window.open;
            window.open = () => null;
        });
        await page.getByRole("button", { name: "Print customer copy", exact: true }).click();
        await page
            .getByText(
                "Allow the order-summary window to open, or download the customer copy instead.",
                { exact: true },
            )
            .waitFor();
        await page.evaluate(() => {
            window.open = window.__savedOpen;
            delete window.__savedOpen;
        });
        await page.route("**/api/notebook/copy?*", (route) =>
            route.fulfill({
                status: 503,
                contentType: "application/json",
                body: JSON.stringify({ error: "Copy retry test" }),
            }),
        );
        const failedEvent = page.waitForEvent("popup");
        await page.getByRole("button", { name: "Print customer copy", exact: true }).click();
        const failedPopup = await failedEvent;
        await page.getByText("Copy retry test", { exact: true }).waitFor();
        if (!failedPopup.isClosed()) await failedPopup.waitForEvent("close");
        await page.unroute("**/api/notebook/copy?*");
        await page.getByRole("button", { name: "Close order details", exact: true }).click();
        await page
            .locator("#notebook-sidebar nav")
            .getByRole("button", { name: /^Suppliers/ })
            .click();
        await page.locator(".purchase-orders > summary").click();
        await page.getByLabel("Search purchases", { exact: true }).fill(purchase.reference);
        await page
            .locator(".purchase-record > summary")
            .filter({ hasText: purchase.reference })
            .click();
        const supplierDownload = page.waitForEvent("download");
        await page.getByRole("button", { name: "Download supplier copy", exact: true }).click();
        assert.ok((await supplierDownload).suggestedFilename().startsWith("purchase-"));
        const supplierPrint = page.waitForEvent("popup");
        await page.getByRole("button", { name: "Print purchase order", exact: true }).click();
        const supplierPopup = await supplierPrint;
        await supplierPopup.getByRole("heading", { name: "Purchase order", exact: true }).waitFor();
        await supplierPopup.close();
        assert.ok(reads.some((url) => url.includes("/api/notebook/copy?")));
        assert.ok(!reads.some((url) => url.includes("/pages?")));
        assert.deepEqual(
            (await (await context.request.get(base + "/api/notebook")).json()).document,
            document,
        );
        pass(
            "Actual download/print actions request server copies without hydration; popup blocking is reported and records stay unchanged",
        );
        assert.equal((await context.request.get(copyUrl("customer", order.id, 0))).status(), 409);
        assert.equal((await context.request.get(copyUrl("purchase", "missing"))).status(), 404);
        assert.equal((await context.request.get(copyUrl("invalid", order.id))).status(), 400);
        assert.equal(
            (await context.request.get(base + "/api/notebook/summary?period=all")).status(),
            400,
        );
        const other = await browser.newContext();
        await signup(other, "notebook-server-copies-other");
        assert.equal((await other.request.get(copyUrl("customer", order.id, 0))).status(), 404);
        assert.equal((await other.request.get(copyUrl("purchase", purchase.id, 0))).status(), 404);
        await other.close();
        const anon = await browser.newContext();
        assert.equal((await anon.request.get(copyUrl("customer", order.id))).status(), 401);
        assert.equal(
            (await anon.request.get(base + "/api/notebook/summary?" + params)).status(),
            401,
        );
        await anon.close();
        assert.equal(
            (
                await context.request.get(copyUrl("customer", order.id), {
                    headers: { "X-Notebook-User": "wrong" },
                })
            ).status(),
            401,
        );
        pass(
            "Server copies and summary exports reject stale, missing, invalid, anonymous and cross-account requests",
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
                .find((line) => line.includes("verify-server-copies.cjs")) || "",
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
            "verification/server-copies-e2e.json",
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
