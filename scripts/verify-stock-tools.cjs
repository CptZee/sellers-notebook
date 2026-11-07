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
            assert.equal(
                (
                    await ctx.request.post(base + "/api/account/tour", {
                        headers: { Origin: base },
                        data: { completed: true },
                    })
                ).status(),
                200,
            );
            await p.close();
            return user;
        }
        const user = await signup(context, "notebook-records"),
            { createSampleNotebook } = await import("../lib/sample-notebook.mjs"),
            document = createSampleNotebook();
        let response = await context.request.put(base + "/api/notebook", {
            headers: { Origin: base },
            data: { revision: 0, document },
        });
        assert.equal(response.status(), 200, await response.text());
        let revision = (await response.json()).revision;
        const page = await context.newPage(),
            reads = [];
        page.on("request", (r) => {
            if (r.method() === "GET") reads.push(r.url());
        });
        await page.goto(base + "/notebook");
        await page
            .locator("#notebook-sidebar nav")
            .getByRole("button", { name: /^Inventory/ })
            .click();
        await page.locator(".restock-plan > summary").click();
        await page
            .locator(".restock-plan")
            .getByRole("button", { name: "New stock adjustment", exact: true })
            .click();
        const modal = page.getByRole("dialog", { name: "New stock adjustment", exact: true });
        await modal.waitFor();
        await page
            .getByLabel("Find an adjustment product", { exact: true })
            .fill(document.products[105].sku);
        await page.getByLabel("Product", { exact: true }).selectOption(document.products[105].id);
        await modal.locator('input[name="quantity"]').fill("3");
        await modal.locator('input[name="reason"]').fill("Targeted stock review");
        let failOnce = true;
        await page.route("**/api/notebook/stock", (route) => {
            if (failOnce) {
                failOnce = false;
                return route.fulfill({
                    status: 503,
                    contentType: "application/json",
                    body: JSON.stringify({ error: "Retry stock test" }),
                });
            }
            return route.continue();
        });
        await modal.getByRole("button", { name: "Record stock adjustment", exact: true }).click();
        await modal.getByText("Retry stock test", { exact: true }).waitFor();
        assert.equal(await modal.locator('input[name="quantity"]').inputValue(), "3");
        const saved = page.waitForResponse(
            (r) => r.url().endsWith("/api/notebook/stock") && r.request().method() === "POST",
        );
        await modal.getByRole("button", { name: "Record stock adjustment", exact: true }).click();
        assert.equal((await saved).status(), 200);
        await modal.waitFor({ state: "hidden" });
        await page
            .locator(".stock-adjustments")
            .getByRole("button", { name: "New stock adjustment", exact: true })
            .click();
        await modal.waitFor();
        await modal.getByRole("button", { name: "Cancel", exact: true }).click();
        pass("New stock adjustment opens from both Restock planner and Stock adjustments");
        let state = await (await context.request.get(base + "/api/notebook")).json();
        assert.equal(state.document.products[105].stock, document.products[105].stock + 3);
        assert.deepEqual(state.document.orders, document.orders);
        assert.deepEqual(state.document.expenses, document.expenses);
        assert.equal(state.document.stockAdjustments.length, document.stockAdjustments.length + 1);
        assert.ok(!reads.some((url) => url.includes("/pages?")));
        pass(
            "Paged stock picker, failed-save draft retention and atomic quantity/history save work without collection hydration",
        );
        const expected = state.document.products[105],
            data = {
                revision: state.revision,
                id: crypto.randomUUID(),
                expected,
                input: { kind: "Damage", quantity: 1, reason: "Race review" },
            };
        const race = await Promise.all(
            [0, 1].map(() =>
                context.request.post(base + "/api/notebook/stock", {
                    headers: { Origin: base },
                    data,
                }),
            ),
        );
        assert.deepEqual(race.map((r) => r.status()).sort(), [200, 409]);
        state = await (await context.request.get(base + "/api/notebook")).json();
        assert.equal(state.document.products[105].stock, expected.stock - 1);
        assert.equal(
            (
                await context.request.post(base + "/api/notebook/stock", {
                    headers: { Origin: base },
                    data: { ...data, revision: state.revision },
                })
            ).status(),
            409,
        );
        pass(
            "Concurrent stock commands commit once and stale product snapshots cannot duplicate changes",
        );
        const anon = await browser.newContext();
        assert.equal(
            (await anon.request.post(base + "/api/notebook/stock", { data: {} })).status(),
            401,
        );
        await anon.close();
        assert.equal(
            (
                await context.request.post(base + "/api/notebook/stock", {
                    headers: { Origin: "https://unrelated.example" },
                    data,
                })
            ).status(),
            403,
        );
        assert.equal(
            (
                await context.request.post(base + "/api/notebook/stock", {
                    headers: { Origin: base, "X-Notebook-User": "other" },
                    data,
                })
            ).status(),
            401,
        );
        pass("Stock commands reject anonymous, wrong-account and cross-origin requests");
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
                .find((line) => line.includes("verify-stock-tools.cjs")) || "",
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
            "verification/stock-tools-e2e.json",
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
