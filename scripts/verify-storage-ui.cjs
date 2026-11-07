const { chromium } = require("@playwright/test"),
    assert = require("node:assert/strict"),
    crypto = require("node:crypto"),
    fs = require("node:fs"),
    path = require("node:path");
const { promisify } = require("node:util");
require("@next/env").loadEnvConfig(process.cwd());
const base = process.env.VERIFY_BASE_URL || "http://127.0.0.1:3000",
    users = [],
    checks = [];
let context, fileId;
const pass = (text) => {
    checks.push(text);
    console.log("PASS " + text);
};
(async () => {
    let browser, failure;
    try {
        browser = await chromium.launch({ channel: "msedge", headless: true });
        context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
        const page = await context.newPage();
        page.setDefaultTimeout(20000);
        await page.goto(base);
        const free = page.locator("#free");
        await free
            .getByText("Free to use, with no account storage quota.", { exact: false })
            .waitFor();
        assert.equal(await page.locator(".subscription-card").count(), 0);
        await free.screenshot({ path: "verification/storage-free-desktop.png" });
        pass("Homepage presents free access without a paid plan or storage allowance");
        for (const width of [390, 320]) {
            await page.setViewportSize({ width, height: 844 });
            assert.ok(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            );
        }
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.goto(base + "/auth/sign-up");
        await page.getByLabel("Your name").fill("Storage review");
        await page.getByLabel("Email address").fill(`storage-review-${Date.now()}@example.com`);
        const password = crypto.randomBytes(24).toString("base64url");
        await page.getByLabel("Password", { exact: true }).fill(password);
        await page.getByLabel("Confirm password", { exact: true }).fill(password);
        await page.getByRole("button", { name: "Create account", exact: true }).click();
        await page.waitForURL(base + "/notebook");
        const initial = await (await context.request.get(base + "/api/notebook/manifest")).json();
        users.push(initial.user.id);
        const usage = async () => {
            const r = await context.request.get(base + "/api/account/storage");
            assert.equal(r.status(), 200, await r.text());
            return r.json();
        };
        assert.equal((await usage()).usedBytes, 0);
        await page.getByRole("button", { name: "Skip tour", exact: true }).click();
        await page.getByRole("button", { name: "Open account and sync settings" }).click();
        await page.getByRole("tab", { name: "Notebook", exact: true }).click();
        const meter = page.getByRole("region", { name: "Account file storage" });
        await meter.getByText("0 MB used", { exact: true }).waitFor();
        await meter.screenshot({ path: "verification/storage-account-desktop.png" });
        const bytes = Buffer.alloc(32768, 97);
        const r = await context.request.post(base + "/api/attachments", {
            headers: {
                Origin: base,
                "Content-Type": "text/plain",
                "X-File-Name": "storage-review.txt",
            },
            data: bytes,
        });
        assert.equal(r.status(), 201, await r.text());
        fileId = (await r.json()).id;
        assert.equal((await usage()).usedBytes, bytes.length);
        await meter.getByRole("button", { name: "Refresh storage usage" }).click();
        await meter.getByText("0.03 MB used", { exact: true }).waitFor();
        pass("Real private upload counts exact bytes and appears in the account storage meter");
        assert.equal(
            (
                await context.request.post(base + "/api/account/storage", {
                    headers: { Origin: base },
                    data: { allowance: 1 },
                })
            ).status(),
            400,
        );
        assert.equal(
            (
                await context.request.get(base + "/api/account/storage", {
                    headers: { "X-Notebook-User": "different-account" },
                })
            ).status(),
            401,
        );
        assert.equal("plan" in (await usage()), false);
        pass("Browser requests cannot upgrade their own plan or read another account’s usage");
        await page.setViewportSize({ width: 390, height: 844 });
        await meter.screenshot({ path: "verification/storage-account-mobile.png" });
        assert.ok(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
        const removed = await context.request.delete(base + "/api/attachments/" + fileId, {
            headers: { Origin: base },
        });
        assert.equal(removed.status(), 200);
        fileId = null;
        assert.equal((await usage()).usedBytes, 0);
        await meter.getByRole("button", { name: "Refresh storage usage" }).click();
        await meter.getByText("0 MB used", { exact: true }).waitFor();
        const after = await (await context.request.get(base + "/api/notebook/manifest")).json();
        assert.equal(after.revision, initial.revision);
        pass(
            "Deletion frees real storage, mobile layout fits, and business revision stays unchanged",
        );
    } catch (error) {
        failure = error;
        console.error("FAIL", error.stack || error);
    } finally {
        if (fileId && context)
            await context.request
                .delete(base + "/api/attachments/" + fileId, { headers: { Origin: base } })
                .catch(() => {});
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
                console.error("Fixture cleanup failed");
            }
        }
        fs.writeFileSync(
            "verification/storage-ui.json",
            JSON.stringify(
                { passed: !failure, checks, failure: failure ? failure.message : null },
                null,
                2,
            ),
        );
        process.exitCode = failure ? 1 : 0;
    }
})();
