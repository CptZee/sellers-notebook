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
            await p.getByLabel("Your name").fill("Paged orders review");
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
        const user = await signup(context, "notebook-orders");
        const { createSampleNotebook } = await import("../lib/sample-notebook.mjs"),
            { filterOrderList } = await import("../lib/order-management.mjs"),
            { reportRange, inReportRange } = await import("../lib/reporting.mjs");
        const document = createSampleNotebook(),
            today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(
                new Date(),
            );
        for (const id of ["SD-a", "SD-A", "sd.a", "sd-a"])
            document.orders.push({
                id,
                sourceOrderId: "TIE-" + id,
                productId: document.products[0].id,
                productName: document.products[0].name,
                customer: "Sort tie fixture",
                channel: "Direct",
                quantity: 1,
                price: 10,
                cost: 2,
                fee: 0,
                packaging: 0,
                shipping: 0,
                date: today,
                status: "Completed",
                stockApplied: false,
            });
        const statusProduct = document.products[2];
        statusProduct.stock = 50;
        const statusRows = [
            ["zz-status-manual-a", 2, undefined],
            ["zz-status-manual-b", 3, true],
            ["zz-status-imported", 7, false],
            ["zz-status-browser", 4, true],
            ["aa-status-completion", 1, false],
        ].map(([id, quantity, stockApplied]) => ({
            id,
            productId: statusProduct.id,
            productName: statusProduct.name,
            customer: "Status fixture " + id,
            channel: "Direct",
            quantity,
            price: statusProduct.price,
            cost: statusProduct.cost,
            fee: 0,
            packaging: 0,
            shipping: 0,
            date: today,
            status: "Processing",
            ...(stockApplied === undefined ? {} : { stockApplied }),
        }));
        document.orders.push(...statusRows);
        const seeded = await context.request.put(base + "/api/notebook", {
            headers: { Origin: base },
            data: { revision: 0, document },
        });
        assert.equal(seeded.status(), 200, await seeded.text());
        let revision = (await seeded.json()).revision,
            cases = 0;
        for (const period of ["all", "7"])
            for (const channel of ["All channels", "Shopee", "Direct"])
                for (const status of ["All statuses", "Processing", "Completed", "Cancelled"])
                    for (const sort of ["newest", "oldest", "value"]) {
                        const range = reportRange(
                                period,
                                today,
                                [
                                    ...document.orders,
                                    ...document.expenses,
                                    ...document.refundRecords,
                                ].map((row) => row.date),
                            ),
                            expected = filterOrderList(
                                document.orders.filter(
                                    (order) =>
                                        inReportRange(order.date, range) &&
                                        (channel === "All channels" || order.channel === channel),
                                ),
                                document.products,
                                "",
                                status,
                                sort,
                            ),
                            params = new URLSearchParams({
                                revision: String(revision),
                                period,
                                channel,
                                status,
                                sort,
                                page: "2",
                                size: "10",
                            });
                        const response = await context.request.get(
                            base + "/api/notebook/orders?" + params,
                        );
                        assert.equal(response.status(), 200, await response.text());
                        const body = await response.json(),
                            actualPage = Math.min(2, Math.max(1, Math.ceil(expected.length / 10)));
                        assert.equal(body.total, expected.length);
                        assert.equal(body.page, actualPage);
                        assert.deepEqual(
                            body.items.map((row) => row.id),
                            expected
                                .slice((actualPage - 1) * 10, actualPage * 10)
                                .map((row) => row.id),
                        );
                        cases++;
                    }
        const search = document.products[0].sku,
            expectedSearch = filterOrderList(document.orders, document.products, search);
        const searched = await (
            await context.request.get(
                base +
                    "/api/notebook/orders?" +
                    new URLSearchParams({ revision: String(revision), period: "all", search }),
            )
        ).json();
        assert.equal(searched.total, expectedSearch.length);
        assert.deepEqual(
            searched.items.map((row) => row.id),
            expectedSearch.map((row) => row.id),
        );
        pass(
            `SQL order pages match ${cases} period/channel/status/sort combinations, SKU joins and mixed-case ID tie-breaking`,
        );
        const page = await context.newPage(),
            reads = [];
        page.on("request", (request) => {
            if (
                request.method() === "GET" &&
                new URL(request.url()).pathname.startsWith("/api/notebook")
            )
                reads.push(request.url());
        });
        await page.goto(base + "/notebook");
        await page.getByText("Live across your devices", { exact: true }).waitFor();
        await page
            .locator("#notebook-sidebar nav")
            .getByRole("button", { name: /^Orders/ })
            .click();
        await page.getByLabel("Date range", { exact: true }).selectOption("all");
        await page
            .locator(".cloud-orders .pagination")
            .getByText("Page 1 of 15", { exact: true })
            .waitFor();
        assert.equal(await page.locator(".cloud-orders tbody tr").count(), 25);
        assert.ok(!reads.some((url) => url.includes("/pages?")));
        await page.getByRole("button", { name: "Orders: Next page", exact: true }).click();
        await page
            .locator(".cloud-orders .pagination")
            .getByText("Page 2 of 15", { exact: true })
            .waitFor();
        await page.getByLabel("Search orders", { exact: true }).fill(search);
        await page
            .locator(".cloud-orders .pagination")
            .getByText("Page 1 of 1", { exact: true })
            .waitFor();
        assert.equal(await page.locator(".cloud-orders tbody tr").count(), expectedSearch.length);
        await page.getByLabel("Search orders", { exact: true }).fill("");
        await page
            .locator(".cloud-orders .pagination")
            .getByText("Page 1 of 15", { exact: true })
            .waitFor();
        await page.getByLabel("Order status filter", { exact: true }).selectOption("Completed");
        await page.getByLabel("Sort orders", { exact: true }).selectOption("value");
        await page.locator(".cloud-orders tbody tr").first().waitFor();
        const completed = filterOrderList(
            document.orders,
            document.products,
            "",
            "Completed",
            "value",
        );
        await page.waitForFunction(
            (name) =>
                document.querySelector(".cloud-orders tbody tr .order-id")?.textContent ===
                "#" + name,
            completed[0].sourceOrderId || completed[0].id,
        );
        const download = page.waitForEvent("download");
        await page.getByRole("button", { name: "Export", exact: true }).click();
        assert.equal(
            fs.readFileSync(await (await download).path(), "utf8").split("\r\n").length,
            completed.length + 1,
        );
        assert.ok(!reads.some((url) => url.includes("/pages?")));
        for (const width of [320, 390, 768]) {
            await page.setViewportSize({ width, height: 844 });
            await page.waitForFunction((width) => innerWidth === width, width);
            assert.ok(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            );
            fs.mkdirSync("verification/mobile", { recursive: true });
            await page.screenshot({ path: `verification/mobile/cloud-orders-${width}.png` });
        }
        await page.setViewportSize({ width: 1440, height: 1000 });
        pass(
            "Orders browse/search/filter/sort/paginate and export every match without full hydration; phone/tablet layouts fit",
        );
        await page.getByLabel("Order status filter", { exact: true }).selectOption("Processing");
        await page.getByLabel("Sort orders", { exact: true }).selectOption("newest");
        await page.locator(".cloud-orders tbody input[type=checkbox]").first().check();
        await page.getByRole("button", { name: "Complete selected", exact: true }).click();
        const dialog = page.getByRole("dialog", { name: "Please confirm", exact: true });
        await dialog.waitFor();
        const note = await context.request.patch(base + "/api/notebook", {
            headers: { Origin: base },
            data: { revision, changes: { sidebarNote: "Changed while confirmation was open" } },
        });
        assert.equal(note.status(), 200, await note.text());
        revision = (await note.json()).revision;
        await page.waitForFunction(() =>
            [...document.querySelectorAll("[role=dialog] button")].some(
                (button) => button.textContent === "Continue" && button.disabled,
            ),
        );
        await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
        assert.ok(!reads.some((url) => url.includes("/pages?")));
        pass(
            "A revision change invalidates an open bulk confirmation even while order collections are unloaded",
        );
        const target = filterOrderList(
            document.orders,
            document.products,
            "",
            "Processing",
            "newest",
        )[0];
        await page.locator(".cloud-orders tbody input[type=checkbox]").first().check();
        await page.getByRole("button", { name: "Complete selected", exact: true }).click();
        await dialog.waitFor();
        const saved = page.waitForResponse(
            (response) =>
                response.url().endsWith("/api/notebook/order") &&
                response.request().method() === "POST",
        );
        await dialog.getByRole("button", { name: "Continue", exact: true }).click();
        const save = await saved;
        assert.equal(save.status(), 200, await save.text());
        const payload = save.request().postDataJSON();
        assert.equal(payload.kind, "transition");
        assert.deepEqual(payload.input, { action: "Completed" });
        assert.deepEqual(payload.expected, [target]);
        assert.equal(payload.document, undefined);
        const after = await (await context.request.get(base + "/api/notebook")).json();
        revision = after.revision;
        assert.equal(after.document.orders.length, document.orders.length);
        assert.equal(
            after.document.orders.find((order) => order.id === target.id).status,
            "Completed",
        );
        assert.deepEqual(after.document.products, document.products);
        assert.ok(!reads.some((url) => url.includes("/pages?")));
        pass(
            "Bulk completion sends only selected snapshots, preserves stock/history and never hydrates collections",
        );
        const cancellation = {
            kind: "transition",
            id: "cancel-command",
            revision,
            input: { action: "Cancelled" },
            expected: statusRows.slice(0, 3),
        };
        const attempts = await Promise.all(
            [0, 1].map((index) =>
                context.request.post(base + "/api/notebook/order", {
                    headers: { Origin: base },
                    data: { ...cancellation, id: "cancel-command-" + index },
                }),
            ),
        );
        assert.deepEqual(attempts.map((response) => response.status()).sort(), [200, 409]);
        let cancelled = await (await context.request.get(base + "/api/notebook")).json();
        revision = cancelled.revision;
        assert.equal(cancelled.document.products.find((p) => p.id === statusProduct.id).stock, 55);
        for (const row of statusRows.slice(0, 3))
            assert.equal(
                cancelled.document.orders.find((order) => order.id === row.id).status,
                "Cancelled",
            );
        for (const key of [
            "stockAdjustments",
            "refundRecords",
            "expenses",
            "suppliers",
            "purchaseOrders",
        ])
            assert.deepEqual(cancelled.document[key], document[key]);
        assert.deepEqual(
            cancelled.document.orders.filter(
                (order) => !statusRows.slice(0, 3).some((row) => row.id === order.id),
            ),
            after.document.orders.filter(
                (order) => !statusRows.slice(0, 3).some((row) => row.id === order.id),
            ),
        );
        for (const expected of [
            [{ ...statusRows[3], customer: "Stale buyer" }],
            [{ ...statusRows[3], id: "missing-order" }],
            [statusRows[3], statusRows[3]],
            Array.from({ length: 101 }, (_, i) => ({ ...statusRows[3], id: "too-many-" + i })),
        ])
            assert.equal(
                (
                    await context.request.post(base + "/api/notebook/order", {
                        headers: { Origin: base },
                        data: {
                            kind: "transition",
                            id: "reject-batch",
                            revision,
                            input: { action: "Completed" },
                            expected,
                        },
                    })
                ).status(),
                409,
            );
        assert.equal(
            (await (await context.request.get(base + "/api/notebook")).json()).revision,
            revision,
        );
        pass(
            "Concurrent bulk cancellation restores combined manual reservations exactly once, excludes imported stock, and rejects stale/missing/duplicate/oversized selections atomically",
        );
        await page.getByLabel("Search orders", { exact: true }).fill(statusRows[3].id);
        await page
            .locator(".cloud-orders tbody")
            .getByText(statusRows[3].customer, { exact: true })
            .waitFor();
        const singleSave = page.waitForResponse(
            (response) =>
                response.url().endsWith("/api/notebook/order") &&
                response.request().method() === "POST",
        );
        await page
            .locator(".cloud-orders tbody")
            .getByRole("button", { name: "Cancel", exact: true })
            .click();
        assert.equal((await singleSave).status(), 200);
        cancelled = await (await context.request.get(base + "/api/notebook")).json();
        revision = cancelled.revision;
        assert.equal(cancelled.document.products.find((p) => p.id === statusProduct.id).stock, 59);
        assert.equal(
            cancelled.document.orders.find((order) => order.id === statusRows[3].id).status,
            "Cancelled",
        );
        assert.ok(!reads.some((url) => url.includes("/pages?")));
        pass(
            "Single cancellation also uses the targeted command and restores only that reservation without loading collections",
        );
        assert.equal(
            (await context.request.get(base + "/api/notebook/orders?revision=0")).status(),
            409,
        );
        for (const query of ["status=Invalid", "sort=invalid", "size=101"])
            assert.equal(
                (
                    await context.request.get(
                        base + "/api/notebook/orders?revision=" + revision + "&" + query,
                    )
                ).status(),
                400,
            );
        const other = await browser.newContext();
        await signup(other, "notebook-orders-other");
        const empty = await (
            await other.request.get(base + "/api/notebook/orders?revision=0&period=all")
        ).json();
        assert.equal(empty.total, 0);
        assert.deepEqual(empty.items, []);
        assert.equal(
            (
                await other.request.get(base + "/api/notebook/orders?revision=" + revision, {
                    headers: { "X-Notebook-User": user.id },
                })
            ).status(),
            401,
        );
        await other.close();
        const anon = await browser.newContext();
        assert.equal(
            (await anon.request.get(base + "/api/notebook/orders?revision=0")).status(),
            401,
        );
        await anon.close();
        pass("Order pages enforce revision, bounds, filter validation and real-account isolation");
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
                .find((line) => line.includes("verify-orders.cjs")) || "",
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
            "verification/orders-e2e.json",
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
