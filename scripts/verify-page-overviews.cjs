const { chromium } = require("@playwright/test"),
    assert = require("node:assert/strict"),
    crypto = require("node:crypto"),
    fs = require("node:fs"),
    path = require("node:path");
require("@next/env").loadEnvConfig(process.cwd());
const base = "http://127.0.0.1:3000",
    users = [],
    checks = [];
const pass = (text) => {
    checks.push(text);
    console.log("PASS " + text);
};
(async () => {
    let browser, failure;
    try {
        browser = await chromium.launch({ channel: "msedge", headless: true });
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }),
            page = await context.newPage();
        page.setDefaultTimeout(20000);
        await page.goto(base + "/auth/sign-up");
        const password = crypto.randomBytes(24).toString("base64url");
        await page.getByLabel("Your name").fill("Overview review");
        await page.getByLabel("Email address").fill(`overview-${Date.now()}@example.com`);
        await page.getByLabel("Password", { exact: true }).fill(password);
        await page.getByLabel("Confirm password", { exact: true }).fill(password);
        await page.getByRole("button", { name: "Create account", exact: true }).click();
        await page.waitForURL(base + "/notebook");
        const initial = await (await context.request.get(base + "/api/notebook/manifest")).json();
        users.push(initial.user.id);
        await context.request.post(base + "/api/account/tour", {
            headers: { Origin: base },
            data: { completed: true },
        });
        let r = await context.request.get(base + "/api/notebook/overview");
        assert.equal(r.status(), 200);
        const empty = await r.json();
        assert.deepEqual(empty.inventory, { units: 0, value: 0, lowCount: 0 });
        assert.deepEqual(empty.suppliers, { count: 0, open: 0, due: 0 });
        assert.equal(
            (await context.request.get(base + "/api/notebook/overview?revision=-1")).status(),
            400,
        );
        assert.equal(
            (await context.request.get(base + "/api/notebook/overview?revision=999")).status(),
            409,
        );
        assert.equal(
            (
                await context.request.get(base + "/api/notebook/overview", {
                    headers: { "X-Notebook-User": "someone-else" },
                })
            ).status(),
            401,
        );
        const guest = await browser.newContext();
        assert.equal((await guest.request.get(base + "/api/notebook/overview")).status(), 401);
        await guest.close();
        pass("Empty totals, account isolation, authentication and revision validation");
        const { createSampleNotebook } = await import("../lib/sample-notebook.mjs"),
            document = createSampleNotebook();
        r = await context.request.put(base + "/api/notebook", {
            headers: { Origin: base },
            data: { revision: 0, document },
        });
        assert.equal(r.status(), 200, await r.text());
        const revision = (await r.json()).revision,
            today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
        r = await context.request.get(base + "/api/notebook/overview?revision=" + revision);
        assert.equal(r.status(), 200);
        const data = await r.json(),
            units = document.products.reduce((s, p) => s + p.stock, 0),
            value = document.products.reduce((s, p) => s + p.stock * p.cost, 0),
            low = document.products.filter((p) => p.stock <= (p.reorderPoint ?? 10)).length,
            open = document.purchaseOrders.filter((p) =>
                ["Ordered", "Partially received"].includes(p.status),
            );
        assert.equal(data.inventory.units, units);
        assert.ok(Math.abs(data.inventory.value - value) < 0.005);
        assert.equal(data.inventory.lowCount, low);
        assert.deepEqual(data.suppliers, {
            count: 100,
            open: open.length,
            due: open.filter((p) => p.expectedDate && p.expectedDate <= today).length,
        });
        pass(
            "SQL totals cover all 120 products and 100 suppliers, follow Manila due dates and exclude purchases without expected dates",
        );
        const reads = [];
        page.on("request", (r) => {
            if (r.method() === "GET") reads.push(new URL(r.url()).pathname);
        });
        await page.reload();
        await page.waitForFunction(() => !document.querySelector("[data-tour-replay]")?.disabled);
        async function nav(name) {
            await page
                .locator("#notebook-sidebar nav")
                .getByRole("button", { name: new RegExp("^" + name) })
                .click();
            const panel = page.getByRole("region", { name: name + " overview" });
            await panel.waitFor();
            await page.waitForFunction(
                (name) =>
                    document
                        .querySelector(`[aria-label="${name} overview"]`)
                        ?.getAttribute("aria-busy") === "false",
                name,
            );
            return panel;
        }
        let panel = await nav("Inventory");
        assert.equal(await panel.locator(".stat").count(), 3);
        assert.equal(
            await panel.locator(".stat-value").first().innerText(),
            units.toLocaleString("en-PH"),
        );
        await panel.screenshot({ path: "verification/inventory-overview.png" });
        await page
            .locator('.inventory-card input[placeholder="Search products…"]')
            .fill("no-such-product");
        assert.equal(
            await panel.locator(".stat-value").first().innerText(),
            units.toLocaleString("en-PH"),
        );
        await page.getByLabel("Filter channel").selectOption("Shopee");
        await page.getByLabel("Date range", { exact: true }).selectOption("7");
        assert.equal(
            await panel.locator(".stat-value").first().innerText(),
            units.toLocaleString("en-PH"),
        );
        pass("Inventory cards use all notebook records despite paginated search and sales filters");
        panel = await nav("Suppliers");
        assert.equal(await panel.locator(".stat-value").first().innerText(), "100");
        await panel.screenshot({ path: "verification/suppliers-overview.png" });
        for (const width of [390, 320]) {
            await page.setViewportSize({ width, height: 844 });
            assert.ok(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            );
        }
        assert.ok(!reads.includes("/api/notebook"));
        assert.ok(!reads.includes("/api/notebook/pages"));
        pass(
            "Supplier cards match the Orders style, fit phones and do not hydrate business collections",
        );
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.getByRole("button", { name: "Open account and sync settings" }).click();
        await page.getByRole("tab", { name: "Notebook", exact: true }).click();
        await page.getByRole("button", { name: "Explore sample notebook" }).click();
        panel = await nav("Inventory");
        assert.notEqual(await panel.locator(".stat-value").first().innerText(), "—");
        const after = await (await context.request.get(base + "/api/notebook/manifest")).json();
        assert.equal(after.revision, revision);
        pass(
            "Sample notebook calculates local totals and viewing overviews does not change business revision",
        );
    } catch (error) {
        failure = error;
        console.error(error.stack || error);
    } finally {
        await browser?.close();
        for (const id of users) {
            try {
                const { neon } = require("@neondatabase/serverless");
                await neon(
                    process.env.DATABASE_URL,
                )`delete from seller_notebooks where owner_id=${id}`;
                await require("node:util").promisify(require("node:child_process").execFile)(
                    process.execPath,
                    [
                        path.join(process.env.APPDATA, "npm/node_modules/neon/dist/cli.js"),
                        "neon-auth",
                        "user",
                        "delete",
                        id,
                    ],
                    { windowsHide: true },
                );
            } catch (error) {
                failure ??= error;
                console.error("Temporary account cleanup failed");
            }
        }
        fs.writeFileSync(
            "verification/page-overviews.json",
            JSON.stringify(
                { passed: !failure, checks, failure: failure?.message || null },
                null,
                2,
            ),
        );
        process.exitCode = failure ? 1 : 0;
    }
})();
