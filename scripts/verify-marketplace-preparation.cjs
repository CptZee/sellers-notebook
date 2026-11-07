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
        const user = await signup(context, "notebook-marketplace-preparation"),
            { createSampleNotebook } = await import("../lib/sample-notebook.mjs"),
            document = createSampleNotebook();
        let response = await context.request.put(base + "/api/notebook", {
            headers: { Origin: base },
            data: { revision: 0, document },
        });
        assert.equal(response.status(), 200, await response.text());
        let revision = (await response.json()).revision;
        context.setDefaultTimeout(15000);
        for (const platform of ["lazada", "tiktok"]) {
            const status = await context.request.get(base + "/api/marketplaces/" + platform);
            assert.equal(status.status(), 200);
            const state = await status.json();
            assert.equal(state.configured, false);
            assert.equal(state.orderImportAvailable, false);
            assert.equal(state.connected, false);
            assert.ok(!JSON.stringify(state).includes("token"));
            const fetch = await context.request.post(
                base + "/api/marketplaces/" + platform + "/orders",
                { headers: { Origin: base }, data: { from: "2026-11-05", to: "2026-11-06" } },
            );
            assert.equal(fetch.status(), 503);
            assert.ok((await fetch.json()).error.includes("coming soon"));
            assert.equal(
                (
                    await context.request.post(base + "/api/marketplaces/" + platform + "/orders", {
                        headers: { Origin: "https://unrelated.example" },
                        data: {},
                    })
                ).status(),
                403,
            );
            assert.equal(
                (
                    await context.request.post(base + "/api/marketplaces/" + platform + "/orders", {
                        headers: { Origin: base, "X-Notebook-User": "wrong" },
                        data: {},
                    })
                ).status(),
                401,
            );
        }
        pass(
            "Missing credentials keep both direct import paths disabled, return coming-soon notices and enforce origin/account guards",
        );
        const page = await context.newPage();
        await page.goto(base + "/notebook");
        await page
            .locator("#notebook-sidebar nav")
            .getByRole("button", { name: /^Orders/ })
            .click();
        await page.locator(".marketplace-drawer > summary").click();
        for (const label of ["Lazada", "TikTok Shop"]) {
            const button = page.getByRole("button", {
                name: "Connect " + label + " shop",
                exact: true,
            });
            await button.waitFor();
            assert.equal(await button.isDisabled(), true);
            assert.equal(
                await page
                    .getByRole("button", { name: "Fetch " + label + " orders", exact: true })
                    .count(),
                0,
            );
        }
        await page.getByRole("button", { name: "Import orders CSV", exact: true }).click();
        await page.getByLabel("Marketplace for CSV", { exact: true }).selectOption("TikTok Shop");
        await page.getByLabel("Choose TikTok Shop CSV", { exact: true }).waitFor();
        pass(
            "Both connection buttons stay disabled in the actual UI while marketplace CSV imports remain available",
        );
        await page.getByRole("button", { name: "Close importer", exact: true }).click();
        const reads = [];
        page.on("request", (r) => {
            if (r.method() === "GET") reads.push(r.url());
        });
        for (const [platform, name] of [
            ["lazada", "Lazada"],
            ["tiktok", "TikTok Shop"],
        ]) {
            await page.route("**/api/marketplaces/" + platform, (route) =>
                route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    body: JSON.stringify({
                        configured: true,
                        connected: true,
                        needsReconnect: false,
                        orderImportAvailable: true,
                        account: { id: "fixture-account" },
                    }),
                }),
            );
            let requests = 0;
            const shops = [
                { id: "one", name: "First PH shop", cipher: "c1" },
                { id: "two", name: "Second PH shop", cipher: "c2" },
            ];
            await page.route("**/api/marketplaces/" + platform + "/orders", (route) => {
                requests++;
                if (platform === "tiktok" && requests === 1)
                    return route.fulfill({
                        status: 200,
                        contentType: "application/json",
                        body: JSON.stringify({ platform: name, rows: null, shops }),
                    });
                if (platform === "tiktok")
                    assert.equal(route.request().postDataJSON().shopCipher, "c2");
                return route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    body: JSON.stringify({
                        platform: name,
                        shopId: "fixture-shop",
                        rows: [
                            {
                                "Order ID": "FETCHED-" + platform,
                                "Seller SKU": document.products[0].sku,
                                Quantity: "1",
                                "Unit Price": "10.00",
                                "Order Date": "2026-11-05",
                                "Order Status": "COMPLETED",
                                Currency: "PHP",
                            },
                        ],
                    }),
                });
            });
            await page.reload();
            await page
                .locator("#notebook-sidebar nav")
                .getByRole("button", { name: /^Orders/ })
                .click();
            await page.locator(".marketplace-drawer > summary").click();
            await page
                .getByRole("button", { name: "Fetch " + name + " orders", exact: true })
                .click();
            if (platform === "tiktok") {
                await page
                    .getByLabel(name + " authorized shop", { exact: true })
                    .selectOption("c2");
                await page
                    .getByRole("button", { name: "Fetch " + name + " orders", exact: true })
                    .click();
            }
            await page.getByText("1 new lines", { exact: true }).waitFor();
            assert.equal(
                await page.getByLabel("Marketplace for CSV", { exact: true }).inputValue(),
                name,
            );
            assert.equal(
                await page.getByLabel("Marketplace for CSV", { exact: true }).isDisabled(),
                true,
            );
            await page.getByRole("button", { name: "Close importer", exact: true }).click();
        }
        assert.ok(!reads.some((url) => url.includes("/pages?")));
        pass(
            "Mocked configured fetches flow into platform-correct previews and TikTok multi-shop selection without hydration or saving automatically",
        );
        const anon = await browser.newContext();
        for (const platform of ["lazada", "tiktok"])
            assert.equal(
                (
                    await anon.request.post(base + "/api/marketplaces/" + platform + "/orders", {
                        data: {},
                    })
                ).status(),
                401,
            );
        await anon.close();
        assert.equal(
            (
                await context.request.post(base + "/api/marketplaces/unknown/orders", {
                    headers: { Origin: base },
                    data: {},
                })
            ).status(),
            404,
        );
        assert.deepEqual(
            (await (await context.request.get(base + "/api/notebook")).json()).document,
            document,
        );
        pass(
            "Prepared endpoints reject anonymous/unknown platforms and never write fetched history automatically",
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
                .find((line) => line.includes("verify-marketplace-preparation.cjs")) || "",
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
            "verification/marketplace-preparation-e2e.json",
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
