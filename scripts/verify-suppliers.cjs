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
        const user = await signup(context, "notebook-suppliers"),
            { createSampleNotebook } = await import("../lib/sample-notebook.mjs"),
            { filterSuppliers } = await import("../lib/supplier-list.mjs"),
            document = createSampleNotebook();
        for (const [index, name] of ["alpha", "Alpha", "Alpha", "Álpha"].entries())
            document.suppliers.push({
                id: "supplier-tie-" + index,
                name,
                contact: "Contact " + index,
                email: `alpha${index}@example.com`,
                phone: index === 0 ? "Literal %_ phone" : "12345",
                address: "Fixture address",
                notes: "Private fixture notes",
                leadTimeDays: 0,
                productIds: index === 1 ? [document.products[0].id] : [],
            });
        const seeded = await context.request.put(base + "/api/notebook", {
            headers: { Origin: base },
            data: { revision: 0, document },
        });
        assert.equal(seeded.status(), 200, await seeded.text());
        let revision = (await seeded.json()).revision,
            cases = 0;
        for (const search of [
            "",
            "alpha",
            "SAMPLE",
            "@example",
            "123",
            "%_",
            document.products[0].sku,
            document.products[0].name,
            "No matching contact",
        ])
            for (const size of [10, 25, 100])
                for (const page of [1, 2, 999]) {
                    const expected = filterSuppliers(document.suppliers, document.products, search),
                        response = await context.request.get(
                            base +
                                "/api/notebook/suppliers?" +
                                new URLSearchParams({
                                    revision: String(revision),
                                    search,
                                    size: String(size),
                                    page: String(page),
                                }),
                        );
                    assert.equal(response.status(), 200, await response.text());
                    const body = await response.json(),
                        actualPage = Math.min(page, Math.max(1, Math.ceil(expected.length / size)));
                    assert.equal(body.total, expected.length);
                    assert.equal(body.page, actualPage);
                    assert.deepEqual(
                        body.items.map((row) => row.id),
                        expected
                            .slice((actualPage - 1) * size, actualPage * size)
                            .map((row) => row.id),
                    );
                    cases++;
                }
        pass(
            `SQL supplier pages match ${cases} search/size/page combinations, linked product/SKU search, literal text and stable mixed-case/accent name ordering`,
        );
        async function supplierPage() {
            const p = await context.newPage(),
                reads = [];
            p.on("request", (r) => {
                if (r.method() === "GET" && new URL(r.url()).pathname.startsWith("/api/notebook"))
                    reads.push(r.url());
            });
            await p.goto(base + "/notebook");
            await p.getByText("Live across your devices", { exact: true }).waitFor();
            await p
                .locator("#notebook-sidebar nav")
                .getByRole("button", { name: /^Suppliers/ })
                .click();
            await p
                .getByRole("navigation", { name: "Suppliers pagination", exact: true })
                .waitFor();
            return { p, reads };
        }
        const { p: page, reads } = await supplierPage();
        assert.equal(await page.locator(".supplier-manager tbody tr").count(), 25);
        assert.equal(await page.locator(".view-label").innerText(), "104 supplier connections");
        assert.ok(!reads.some((url) => url.includes("/pages?")));
        await page.getByRole("button", { name: "Suppliers: Next page", exact: true }).click();
        await page
            .getByRole("navigation", { name: "Suppliers pagination", exact: true })
            .getByText("Page 2 of 5", { exact: true })
            .waitFor();
        await page.getByLabel("Search suppliers", { exact: true }).fill(document.products[0].sku);
        await page
            .getByRole("navigation", { name: "Suppliers pagination", exact: true })
            .getByText("Page 1 of 1", { exact: true })
            .waitFor();
        assert.equal(await page.locator(".supplier-manager tbody tr").count(), 2);
        const filtered = page.waitForEvent("download");
        await page.getByRole("button", { name: "Export suppliers", exact: true }).click();
        assert.equal(
            fs.readFileSync(await (await filtered).path(), "utf8").split("\r\n").length,
            3,
        );
        await page.getByLabel("Search suppliers", { exact: true }).fill("");
        await page
            .getByRole("navigation", { name: "Suppliers pagination", exact: true })
            .getByText("Page 1 of 5", { exact: true })
            .waitFor();
        const all = page.waitForEvent("download");
        await page.getByRole("button", { name: "Export suppliers", exact: true }).click();
        assert.equal(fs.readFileSync(await (await all).path(), "utf8").split("\r\n").length, 105);
        for (const width of [320, 390, 768]) {
            await page.setViewportSize({ width, height: 844 });
            await page.waitForFunction((width) => innerWidth === width, width);
            assert.ok(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            );
            fs.mkdirSync("verification/mobile", { recursive: true });
            await page.screenshot({ path: `verification/mobile/cloud-suppliers-${width}.png` });
        }
        await page.setViewportSize({ width: 1440, height: 1000 });
        assert.ok(!reads.some((url) => url.includes("/pages?")));
        pass(
            "Contact browsing, page/search reset, complete supplier CSVs and phone/tablet layouts do not hydrate notebook collections",
        );
        const target = document.suppliers[0];
        await page.getByLabel("Search suppliers", { exact: true }).fill(target.email);
        await page
            .getByRole("button", { name: "Delete supplier " + target.name, exact: true })
            .click();
        const dialog = page.getByRole("dialog", { name: "Please confirm", exact: true });
        await dialog.waitFor();
        const changedPurchase = {
            ...document.purchaseOrders[99],
            notes: "Unloaded purchase changed during confirmation",
        };
        const change = await context.request.patch(base + "/api/notebook", {
            headers: { Origin: base },
            data: {
                revision,
                changes: {
                    purchaseOrders: {
                        remove: [],
                        upsert: [{ index: 99, record: changedPurchase }],
                    },
                },
            },
        });
        assert.equal(change.status(), 200, await change.text());
        revision = (await change.json()).revision;
        await page.waitForFunction(() =>
            [...document.querySelectorAll("[role=dialog] button")].some(
                (button) => button.textContent === "Continue" && button.disabled,
            ),
        );
        await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
        assert.ok(!reads.some((url) => url.includes("/pages?")));
        await page
            .getByRole("button", { name: "Delete supplier " + target.name, exact: true })
            .click();
        await dialog.waitFor();
        const removed = page.waitForResponse(
            (r) => r.url().endsWith("/api/notebook/record") && r.request().method() === "POST",
        );
        await dialog.getByRole("button", { name: "Continue", exact: true }).click();
        const save = await removed;
        assert.equal(save.status(), 200, await save.text());
        assert.equal(save.request().postDataJSON().collection, "suppliers");
        assert.equal(save.request().postDataJSON().id, target.id);
        assert.equal(save.request().postDataJSON().record, null);
        assert.ok(!reads.some((url) => url.includes("/pages?")));
        let after = await (await context.request.get(base + "/api/notebook")).json();
        revision = after.revision;
        assert.equal(after.document.suppliers.length, 103);
        assert.deepEqual(after.document.products, document.products);
        assert.deepEqual(after.document.orders, document.orders);
        assert.equal(after.document.purchaseOrders.length, 100);
        assert.equal(after.document.purchaseOrders[99].notes, changedPurchase.notes);
        assert.equal(after.document.purchaseOrders[0].supplierId, target.id);
        pass(
            "An unloaded purchase revision blocks confirmation; confirmed contact deletion preserves inventory, stock and historical purchases",
        );
        const editTarget = document.suppliers[1];
        await page.getByLabel("Search suppliers", { exact: true }).fill(editTarget.email);
        await page
            .getByRole("button", { name: "Edit supplier " + editTarget.name, exact: true })
            .click();
        await page.getByRole("dialog", { name: "Edit supplier", exact: true }).waitFor();
        const newer = { ...editTarget, phone: "555-REMOTE" };
        const remote = await context.request.patch(base + "/api/notebook", {
            headers: { Origin: base },
            data: {
                revision,
                changes: {
                    suppliers: {
                        remove: [],
                        upsert: [
                            {
                                index: after.document.suppliers.findIndex(
                                    (s) => s.id === editTarget.id,
                                ),
                                record: newer,
                            },
                        ],
                    },
                },
            },
        });
        assert.equal(remote.status(), 200, await remote.text());
        revision = (await remote.json()).revision;
        await page.waitForFunction(() =>
            document.querySelector(".supplier-manager tbody")?.textContent.includes("555-REMOTE"),
        );
        await page.getByRole("button", { name: "Save supplier", exact: true }).click();
        await page
            .getByText(
                "This supplier changed on another device. Cancel and reopen the latest entry.",
                { exact: true },
            )
            .waitFor();
        await page.getByRole("button", { name: "Cancel supplier edit", exact: true }).click();
        pass(
            "Supplier edit drafts survive list refresh and reject newer remote contact/link changes",
        );
        assert.ok(!reads.some((url) => url.includes("/pages?")));
        await page
            .getByRole("button", { name: "Edit supplier " + newer.name, exact: true })
            .click();
        await page.getByRole("dialog", { name: "Edit supplier", exact: true }).waitFor();
        const beforeLinks = reads.filter((url) => url.includes("/inventory?")).length;
        await page.waitForTimeout(100);
        assert.equal(reads.filter((url) => url.includes("/inventory?")).length, beforeLinks);
        await page.locator(".supplier-products > summary").click();
        await page
            .getByRole("navigation", { name: "Supplier products pagination", exact: true })
            .getByText("Page 1 of 5", { exact: true })
            .waitFor();
        const linked = [document.products[105], document.products[110]];
        for (const product of linked) {
            await page.getByLabel("Find products to link", { exact: true }).fill(product.sku);
            await page
                .locator(".supplier-product-options label")
                .filter({ hasText: product.sku })
                .getByRole("checkbox")
                .check();
        }
        await page.getByLabel("Find products to link", { exact: true }).fill("");
        await page
            .getByLabel("Supplier products rows per page", { exact: true })
            .selectOption("10");
        await page
            .getByRole("navigation", { name: "Supplier products pagination", exact: true })
            .getByText("Page 1 of 12", { exact: true })
            .waitFor();
        await page
            .getByRole("button", { name: "Supplier products: Next page", exact: true })
            .click();
        await page
            .getByRole("navigation", { name: "Supplier products pagination", exact: true })
            .getByText("Page 2 of 12", { exact: true })
            .waitFor();
        await page.getByLabel("Find products to link", { exact: true }).fill(linked[0].sku);
        assert.equal(
            await page
                .locator(".supplier-product-options label")
                .filter({ hasText: linked[0].sku })
                .getByRole("checkbox")
                .isChecked(),
            true,
        );
        for (const width of [320, 390, 768]) {
            await page.setViewportSize({ width, height: 844 });
            await page.waitForFunction((width) => innerWidth === width, width);
            assert.ok(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            );
            await page.screenshot({
                path: `verification/mobile/cloud-supplier-editor-${width}.png`,
            });
        }
        await page.setViewportSize({ width: 1440, height: 1000 });
        let savedContact = page.waitForResponse(
            (r) => r.url().endsWith("/api/notebook/record") && r.request().method() === "POST",
        );
        await page.getByRole("button", { name: "Save supplier", exact: true }).click();
        assert.equal((await savedContact).status(), 200);
        await page
            .getByRole("dialog", { name: "Edit supplier", exact: true })
            .waitFor({ state: "hidden" });
        let linkedDoc = await (await context.request.get(base + "/api/notebook")).json();
        revision = linkedDoc.revision;
        const linkedSupplier = linkedDoc.document.suppliers.find((s) => s.id === newer.id);
        assert.deepEqual(linkedSupplier.productIds, [
            ...newer.productIds,
            ...linked.map((p) => p.id),
        ]);
        assert.deepEqual(linkedDoc.document.products, document.products);
        assert.equal(linkedDoc.document.purchaseOrders[99].notes, changedPurchase.notes);
        assert.ok(!reads.some((url) => url.includes("/pages?")));
        pass(
            "Lazy supplier product picker keeps unseen links across search/page/size changes and saves only the contact without hydration",
        );
        await page.getByRole("button", { name: "Quick create", exact: true }).click();
        await page
            .getByRole("group", { name: "Create a new entry", exact: true })
            .getByRole("button", { name: "New supplier", exact: true })
            .click();
        await page.getByRole("dialog", { name: "New supplier", exact: true }).waitFor();
        await page.getByLabel("Supplier name", { exact: true }).fill("Targeted retry contact");
        let failedId;
        await page.route("**/api/notebook/record", async (route) => {
            if (route.request().method() === "POST" && !failedId) {
                failedId = route.request().postDataJSON().id;
                await route.fulfill({
                    status: 503,
                    contentType: "application/json",
                    body: JSON.stringify({ error: "Temporary supplier test failure" }),
                });
            } else await route.continue();
        });
        await page.getByRole("button", { name: "Save supplier", exact: true }).click();
        await page.getByText("Temporary supplier test failure", { exact: true }).waitFor();
        assert.equal(
            await page.getByLabel("Supplier name", { exact: true }).inputValue(),
            "Targeted retry contact",
        );
        savedContact = page.waitForResponse(
            (r) => r.url().endsWith("/api/notebook/record") && r.request().method() === "POST",
        );
        await page.getByRole("button", { name: "Save supplier", exact: true }).click();
        const created = await savedContact;
        assert.equal(created.status(), 200);
        assert.equal(created.request().postDataJSON().id, failedId);
        await page
            .getByRole("dialog", { name: "New supplier", exact: true })
            .waitFor({ state: "hidden" });
        await page.unroute("**/api/notebook/record");
        await page.getByLabel("Search suppliers", { exact: true }).fill("Targeted retry contact");
        await page
            .getByRole("button", { name: "Delete supplier Targeted retry contact", exact: true })
            .click();
        await dialog.waitFor();
        savedContact = page.waitForResponse(
            (r) => r.url().endsWith("/api/notebook/record") && r.request().method() === "POST",
        );
        await dialog.getByRole("button", { name: "Continue", exact: true }).click();
        assert.equal((await savedContact).status(), 200);
        linkedDoc = await (await context.request.get(base + "/api/notebook")).json();
        revision = linkedDoc.revision;
        assert.equal(linkedDoc.document.suppliers.length, 103);
        assert.ok(!linkedDoc.document.suppliers.some((s) => s.name === "Targeted retry contact"));
        assert.ok(!reads.some((url) => url.includes("/pages?")));
        pass(
            "FAB supplier creation retains draft/identity after failure; retry creates once and targeted deletion preserves all other contacts",
        );
        for (const [record, expected, status] of [
            [{ ...linkedSupplier, productIds: ["missing-product"] }, linkedSupplier, 409],
            [{ ...linkedSupplier, leadTimeDays: -1 }, linkedSupplier, 400],
            [linkedSupplier, { ...linkedSupplier, phone: "Stale phone" }, 409],
        ])
            assert.equal(
                (
                    await context.request.post(base + "/api/notebook/record", {
                        headers: { Origin: base },
                        data: {
                            collection: "suppliers",
                            id: linkedSupplier.id,
                            record,
                            expected,
                            revision,
                        },
                    })
                ).status(),
                status,
            );
        assert.equal(
            (await (await context.request.get(base + "/api/notebook")).json()).revision,
            revision,
        );
        pass(
            "Targeted supplier API rejects unknown links, invalid details and stale contact snapshots without partial writes",
        );
        const statement = await supplierPage();
        assert.ok(!statement.reads.some((url) => url.includes("/pages?")));
        await statement.p.getByLabel("Search suppliers", { exact: true }).fill(newer.email);
        await statement.p
            .getByRole("button", { name: "Statement for " + newer.name, exact: true })
            .click();
        await statement.p.getByLabel("Statement supplier", { exact: true }).waitFor();
        assert.equal(
            await statement.p.getByLabel("Statement supplier", { exact: true }).inputValue(),
            newer.id,
        );
        assert.ok(!statement.reads.some((url) => url.includes("/pages?")));
        await statement.p.waitForFunction(() =>
            document
                .querySelector(".supplier-statements tbody")
                ?.textContent.includes("SAMPLE-PO-"),
        );
        assert.ok(statement.reads.some((url) => url.includes("/view?")));
        await statement.p.close();
        const tools = await supplierPage();
        assert.ok(!tools.reads.some((url) => url.includes("/pages?")));
        await tools.p.locator(".purchase-orders > summary").click();
        await tools.p.getByRole("button", { name: "New purchase order", exact: true }).click();
        await tools.p.getByRole("dialog", { name: "New purchase order", exact: true }).waitFor();
        await tools.p.getByRole("button", { name: "Cancel purchase entry", exact: true }).click();
        assert.ok(!tools.reads.some((url) => url.includes("/pages?")));
        await tools.p.close();
        assert.equal(
            (await (await context.request.get(base + "/api/notebook")).json()).document
                .purchaseOrders.length,
            100,
        );
        pass(
            "Statement shortcuts and purchase creation stay targeted; cancelled entry creates no records",
        );
        assert.equal(
            (await context.request.get(base + "/api/notebook/suppliers?revision=0")).status(),
            409,
        );
        assert.equal(
            (
                await context.request.get(
                    base + "/api/notebook/suppliers?revision=" + revision + "&size=101",
                )
            ).status(),
            400,
        );
        const other = await browser.newContext();
        await signup(other, "notebook-suppliers-other");
        const empty = await (
            await other.request.get(base + "/api/notebook/suppliers?revision=0")
        ).json();
        assert.equal(empty.total, 0);
        assert.deepEqual(empty.items, []);
        assert.equal(
            (
                await (
                    await other.request.get(base + "/api/notebook/export?kind=suppliers&revision=0")
                ).text()
            ).split("\r\n").length,
            1,
        );
        assert.equal(
            (
                await other.request.get(base + "/api/notebook/suppliers?revision=" + revision, {
                    headers: { "X-Notebook-User": user.id },
                })
            ).status(),
            401,
        );
        await other.close();
        const anon = await browser.newContext();
        assert.equal(
            (await anon.request.get(base + "/api/notebook/suppliers?revision=0")).status(),
            401,
        );
        await anon.close();
        pass(
            "Supplier pages and CSVs enforce bounds, revisions, authentication and real-account isolation",
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
                .find((line) => line.includes("verify-suppliers.cjs")) || "",
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
            "verification/suppliers-e2e.json",
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
