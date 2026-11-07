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
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        for (const route of ["terms", "privacy"]) {
            const r = await page.goto(base + "/" + route);
            assert.equal(r.status(), 200);
            assert.equal(new URL(page.url()).pathname, "/" + route);
            await page.getByRole("heading", { level: 1 }).waitFor();
            assert.equal(await page.locator(".legal-paper>section").count(), 9);
            assert.ok(
                await page
                    .getByRole("link", { name: "ajmission28@gmail.com", exact: true })
                    .count(),
            );
            await page.screenshot({ path: `verification/${route}-desktop.png`, fullPage: true });
            for (const width of [390, 320]) {
                await page.setViewportSize({ width, height: 844 });
                assert.ok(
                    await page.evaluate(
                        () => document.documentElement.scrollWidth <= innerWidth + 1,
                    ),
                );
            }
            await page.locator(".legal-contents nav a").last().click();
            assert.ok(new URL(page.url()).hash);
            await page.screenshot({ path: `verification/${route}-mobile.png` });
            await page.setViewportSize({ width: 1440, height: 1000 });
        }
        pass("Terms and Privacy are public, contactable, navigable and fit desktop/320px/390px");
        await page.goto(base);
        assert.equal(
            await page
                .locator("footer")
                .getByRole("link", { name: "Privacy Policy", exact: true })
                .getAttribute("href"),
            "/privacy",
        );
        await page.goto(base + "/auth/sign-up");
        await page.getByLabel("Your name").fill("Settings layout review");
        await page.getByLabel("Email address").fill(`settings-review-${Date.now()}@example.com`);
        const password = crypto.randomBytes(24).toString("base64url");
        await page.getByLabel("Password", { exact: true }).fill(password);
        await page.getByLabel("Confirm password", { exact: true }).fill(password);
        await page.getByRole("button", { name: "Create account", exact: true }).click();
        await page.waitForURL(base + "/notebook");
        const initial = await (await context.request.get(base + "/api/notebook/manifest")).json();
        users.push(initial.user.id);
        // This test focuses on settings; mandatory onboarding has a separate full traversal test.
        assert.equal(
            (
                await context.request.post(base + "/api/account/tour", {
                    headers: { Origin: base },
                    data: { completed: true },
                })
            ).status(),
            200,
        );
        await page.reload();
        await page.waitForFunction(() => !document.querySelector("[data-tour-replay]")?.disabled);
        await page
            .locator("#notebook-sidebar nav")
            .getByRole("button", { name: /^Orders/ })
            .click();
        const refunds = page.locator(".customer-refund-history"),
            connections = page.locator(".marketplace-connections-card");
        await refunds.locator("summary").click();
        await refunds.getByText("No customer refunds recorded yet.", { exact: false }).waitFor();
        assert.equal(await refunds.locator("table").count(), 0);
        await connections.locator("summary").click();
        await connections.getByRole("heading", { name: "Shopee", exact: true }).waitFor();
        const metrics = (card) =>
            card.locator("summary").evaluate((el) => ({
                padding: getComputedStyle(el).padding,
                font: getComputedStyle(el.querySelector("h2")).font,
            }));
        assert.deepEqual(await metrics(refunds), await metrics(connections));
        await refunds.screenshot({ path: "verification/refunds-layout.png" });
        await connections.screenshot({ path: "verification/marketplace-layout.png" });
        pass(
            "Refund history and marketplace connections share card typography/spacing and a clear empty refund state",
        );
        const statuses = await Promise.all(
            ["/api/shopee", "/api/marketplaces/lazada", "/api/marketplaces/tiktok"].map(
                async (endpoint) => {
                    const r = await context.request.get(base + endpoint);
                    assert.equal(r.status(), 200);
                    return r.json();
                },
            ),
        );
        await page.getByRole("button", { name: "Open account and sync settings" }).click();
        await page.getByRole("tab", { name: "Connections", exact: true }).click();
        const settings = page.locator(".settings-marketplaces");
        for (const name of ["Shopee", "Lazada", "TikTok Shop"])
            await settings.getByRole("heading", { name, exact: true }).waitFor();
        for (const [index, name] of ["Shopee", "Lazada", "TikTok Shop"].entries())
            if (!statuses[index].configured)
                assert.equal(
                    await settings
                        .getByRole("button", { name: `Connect ${name} shop`, exact: true })
                        .isDisabled(),
                    true,
                );
        await settings.screenshot({ path: "verification/settings-connections-desktop.png" });
        await page.getByRole("tab", { name: "Connections", exact: true }).focus();
        await page.keyboard.press("ArrowLeft");
        assert.equal(
            await page
                .getByRole("tab", { name: "Branding", exact: true })
                .getAttribute("aria-selected"),
            "true",
        );
        await page.keyboard.press("ArrowRight");
        assert.equal(
            await page
                .getByRole("tab", { name: "Connections", exact: true })
                .getAttribute("aria-selected"),
            "true",
        );
        pass(
            "Settings exposes all three real connection states and four-tab keyboard navigation works",
        );
        for (const width of [390, 320]) {
            await page.setViewportSize({ width, height: 844 });
            assert.ok(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            );
            const box = await page.locator(".account-tabs").boundingBox();
            assert.ok(box.x >= 0 && box.x + box.width <= width + 1);
            await settings.screenshot({ path: `verification/settings-connections-${width}.png` });
        }
        await page.getByRole("button", { name: "Close account", exact: true }).click();
        const after = await (await context.request.get(base + "/api/notebook/manifest")).json();
        assert.equal(after.revision, initial.revision);
        assert.deepEqual(errors, []);
        pass(
            "Mobile settings fit; viewing settings and public pages changes no business records and produces no runtime errors",
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
                await promisify(require("node:child_process").execFile)(
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
            "verification/settings-legal.json",
            JSON.stringify(
                { passed: !failure, checks, failure: failure?.message || null },
                null,
                2,
            ),
        );
        process.exitCode = failure ? 1 : 0;
    }
})();
