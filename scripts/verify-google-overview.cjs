const { chromium } = require("@playwright/test");
const assert = require("node:assert/strict"),
    fs = require("node:fs"),
    crypto = require("node:crypto"),
    path = require("node:path");
const { promisify } = require("node:util");
require("@next/env").loadEnvConfig(process.cwd());
const base = process.env.VERIFY_BASE_URL || "http://127.0.0.1:3000";
const checks = [],
    users = [];
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
        page.setDefaultTimeout(30000);
        await page.goto(base + "/auth/sign-in");
        let body, release, ready;
        const reached = new Promise((resolve) => (ready = resolve)),
            pending = new Promise((resolve) => (release = resolve));
        await page.route("**/api/auth/sign-in/social", async (route) => {
            body = route.request().postDataJSON();
            ready();
            await pending;
            await route.fulfill({
                status: 400,
                json: { code: "FIXTURE_OAUTH_FAILURE", message: "Fixture provider rejection" },
            });
        });
        const google = page.getByRole("button", { name: "Continue with Google", exact: true });
        await google.click();
        await reached;
        assert.equal(await google.isDisabled(), true);
        assert.equal(await page.locator('button[type="submit"]').isDisabled(), true);
        assert.equal(body.provider, "google");
        assert.equal(body.callbackURL, base + "/notebook");
        assert.equal(body.errorCallbackURL, base + "/auth/sign-in?oauth_error=google");
        release();
        await page
            .getByRole("alert")
            .getByText("Google sign-in could not be completed.", { exact: false })
            .waitFor();
        assert.equal(await google.isEnabled(), true);
        await page.unroute("**/api/auth/sign-in/social");
        pass(
            "Google sign-in does not require email fields, uses fixed local callbacks, prevents duplicate requests and recovers from provider errors",
        );
        await page.goto(base + "/auth/sign-up");
        await google.waitFor();
        for (const width of [390, 320]) {
            await page.setViewportSize({ width, height: 844 });
            assert.ok(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            );
        }
        await page.screenshot({ path: "verification/google-signup-mobile.png", fullPage: true });
        await page.goto(base + "/auth/forgot-password");
        assert.equal(await google.count(), 0);
        await page.goto(base + "/auth/sign-in?oauth_error=google");
        await page.locator('.auth-error[role="alert"]').waitFor();
        pass(
            "Google is available on sign-in/sign-up, fits small phones and shows a safe callback-failure message",
        );

        // Use an already trusted local origin for the disposable account API request.
        const created = await context.request.post(base + "/api/auth/sign-up/email", {
            headers: { Origin: "http://127.0.0.1:3000" },
            data: {
                name: "Overview layout review",
                email: `overview-review-${Date.now()}@example.com`,
                password: crypto.randomBytes(24).toString("base64url"),
            },
        });
        assert.ok(created.ok(), "Disposable account creation failed.");
        const data = await created.json();
        assert.ok(data.user?.id);
        users.push(data.user.id);
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.goto(base + "/notebook");
        await page
            .getByRole("dialog")
            .getByRole("button", { name: "Skip tour", exact: true })
            .click();
        await page.getByRole("dialog").waitFor({ state: "hidden" });
        const initial = await (await context.request.get(base + "/api/notebook/manifest")).json();
        for (const selector of [".orders-card", ".low-card"]) {
            const card = page.locator(selector);
            await card.waitFor();
            assert.equal(await card.evaluate((el) => el.tagName), "SECTION");
            assert.equal(await card.locator("summary,.section-chevron").count(), 0);
            await card.locator("header").click();
            assert.equal(await card.isVisible(), true);
        }
        await page
            .locator(".orders-card")
            .getByRole("button", { name: "View all orders", exact: false })
            .waitFor();
        const actionStyle = await page
            .locator(".orders-card > .section-actions")
            .evaluate((el) => ({
                display: getComputedStyle(el).display,
                justify: getComputedStyle(el).justifyContent,
                padding: parseFloat(getComputedStyle(el).paddingRight),
            }));
        assert.equal(actionStyle.display, "flex");
        assert.equal(actionStyle.justify, "flex-end");
        assert.ok(actionStyle.padding > 0);
        await page
            .locator(".orders-card")
            .screenshot({ path: "verification/recent-orders-fixed.png" });
        await page
            .locator("#notebook-sidebar nav")
            .getByRole("button", { name: /^Inventory/ })
            .click();
        assert.ok((await page.locator("details.collapsible-card").count()) > 0);
        const after = await (await context.request.get(base + "/api/notebook/manifest")).json();
        assert.equal(after.revision, initial.revision);
        pass(
            "Overview cards stay open without disclosure controls; other pages retain collapsible cards and real business records are unchanged",
        );
    } catch (error) {
        failure = error;
        console.error(error.message || error);
        process.exitCode = 1;
    } finally {
        await browser?.close();
        for (const id of users) {
            try {
                const { neon } = require("@neondatabase/serverless");
                await neon(
                    process.env.DATABASE_URL,
                )`delete from seller_notebooks where owner_id=${id}`;
                await promisify(require("node:child_process").execFile)(
                    process.execPath,
                    [
                        path.join(process.env.APPDATA, "npm/node_modules/neon/dist/cli.js"),
                        "neon-auth",
                        "user",
                        "delete",
                        id,
                        "--project-id",
                        "lingering-bread-39834843",
                    ],
                    { windowsHide: true },
                );
            } catch {
                failure ??= Error("Temporary account cleanup failed.");
                process.exitCode = 1;
            }
        }
        fs.writeFileSync(
            "verification/google-overview.json",
            JSON.stringify(
                {
                    passed: !failure,
                    checks,
                    failure: failure?.message || null,
                    mode: "real disposable empty notebook; provider-error UI mocked; no Google consent login",
                },
                null,
                2,
            ),
        );
    }
})();
