const { chromium } = require("@playwright/test"),
    assert = require("node:assert/strict"),
    crypto = require("node:crypto"),
    fs = require("node:fs"),
    path = require("node:path");
const { promisify } = require("node:util");
require("@next/env").loadEnvConfig(process.cwd());
const base = process.env.VERIFY_BASE_URL || "http://127.0.0.1:3000",
    checks = [],
    users = [];
const pass = (text) => {
    checks.push(text);
    console.log("PASS " + text);
};
(async () => {
    let browser, failure, page;
    try {
        const source = await require("esbuild").transform(
                fs.readFileSync("lib/notebook-tour-steps.ts", "utf8"),
                { loader: "ts", format: "esm" },
            ),
            { tourSteps } = await import(
                "data:text/javascript;base64," + Buffer.from(source.code).toString("base64")
            );
        browser = await chromium.launch({ channel: "msedge", headless: true });
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
        page = await context.newPage();
        page.setDefaultTimeout(20000);
        const errors = [],
            writes = [];
        page.on("pageerror", (e) => errors.push(e.message));
        page.on("request", (r) => {
            if (
                new URL(r.url()).pathname.startsWith("/api/") &&
                !["GET", "HEAD"].includes(r.method())
            )
                writes.push({
                    path: new URL(r.url()).pathname,
                    method: r.method(),
                    body: r.postData(),
                });
        });
        const email = `tour-review-${Date.now()}@example.com`,
            password = crypto.randomBytes(24).toString("base64url");
        await page.goto(base + "/auth/sign-up");
        await page.getByLabel("Your name").fill("Detailed tour review");
        await page.getByLabel("Email address").fill(email);
        await page.getByLabel("Password", { exact: true }).fill(password);
        await page.getByLabel("Confirm password", { exact: true }).fill(password);
        await page.getByRole("button", { name: "Create account", exact: true }).click();
        await page.waitForURL(base + "/notebook");
        const initial = await (await context.request.get(base + "/api/notebook/manifest")).json();
        users.push(initial.user.id);
        const before = await (await context.request.get(base + "/api/notebook")).json();
        writes.length = 0;
        const dialog = page.getByRole("dialog");
        await dialog.getByRole("heading", { name: tourSteps[0].title, exact: true }).waitFor();
        assert.equal(await page.locator(".shell").evaluate((e) => e.inert), true);
        await dialog.getByRole("button", { name: "Skip tour", exact: true }).click();
        await dialog.waitFor({ state: "hidden" });
        assert.equal(
            (await (await context.request.get(base + "/api/account/tour")).json()).completed,
            false,
        );
        assert.equal(writes.length, 0);
        await page.reload();
        await page.waitForFunction(
            () =>
                !!document.querySelector("[data-tour-replay]") &&
                !document.querySelector("[data-tour-replay]").disabled,
        );
        assert.equal(await dialog.count(), 0);
        pass(
            "First-run tour is optional; Skip makes no completion/data write and dismissal survives reload",
        );
        await page.getByRole("button", { name: "Take a tour", exact: true }).click();
        await dialog.waitFor();
        for (let i = 0; i < 10; i++) {
            await page.keyboard.press(i % 2 ? "Shift+Tab" : "Tab");
            assert.ok(await dialog.evaluate((el) => el.contains(document.activeElement)));
        }
        await page.keyboard.press("Escape");
        await dialog.waitFor({ state: "hidden" });
        assert.equal(await page.locator(".shell").evaluate((el) => el.inert), false);
        assert.ok(
            await page
                .getByRole("button", { name: "Take a tour", exact: true })
                .evaluate((el) => el === document.activeElement),
        );
        pass(
            "Escape, focus containment and restoration work; the notebook remains usable after skipping",
        );
        let failSave = true;
        await page.route("**/api/account/tour", async (route) => {
            if (route.request().method() === "POST" && failSave) {
                failSave = false;
                await route.fulfill({
                    status: 503,
                    contentType: "application/json",
                    body: JSON.stringify({ error: "Temporary completion failure. Retry or skip." }),
                });
            } else await route.continue();
        });
        async function traverse(width) {
            for (let index = 0; index < tourSteps.length; index++) {
                const step = tourSteps[index];
                await dialog.getByRole("heading", { name: step.title, exact: true }).waitFor();
                const next = dialog.getByRole("button", {
                    name:
                        index === 0
                            ? "Let’s practice"
                            : index === tourSteps.length - 1
                              ? "Finish tour"
                              : "Next",
                    exact: true,
                });
                if (step.exercise) {
                    assert.equal(await next.isDisabled(), true);
                    if (step.exercise === "product")
                        await dialog
                            .getByLabel("Practice product name", { exact: true })
                            .fill("Fictional sunflower tote");
                    if (step.exercise === "pricing") {
                        await dialog
                            .getByLabel("Practice pricing fee (%)", { exact: true })
                            .fill("80");
                        await dialog
                            .getByRole("button", { name: "Apply practice step", exact: true })
                            .click();
                        await dialog.getByRole("alert").waitFor();
                        assert.equal(await next.isDisabled(), true);
                        await dialog
                            .getByLabel("Practice pricing fee (%)", { exact: true })
                            .fill("8");
                    }
                    await dialog
                        .getByRole("button", {
                            name:
                                step.exercise === "complete"
                                    ? "Complete practice sale"
                                    : "Apply practice step",
                            exact: true,
                        })
                        .click();
                    await dialog.locator(".tour-practice-result").waitFor();
                    assert.equal(await next.isEnabled(), true);
                    if (step.exercise === "stock" && width === 1440) {
                        await dialog.getByRole("button", { name: "Back", exact: true }).click();
                        await dialog.getByRole("button", { name: "Next", exact: true }).click();
                        await dialog
                            .locator(".tour-practice-result")
                            .getByText("Practice stock: 20 → 25.", { exact: false })
                            .waitFor();
                    }
                }
                const box = await dialog.boundingBox();
                assert.ok(
                    box.x >= -1 &&
                        box.y >= -1 &&
                        box.x + box.width <= width + 1 &&
                        box.y + box.height <= (await page.viewportSize()).height + 1,
                    "Tour panel exceeds viewport at step " + index + ": " + JSON.stringify(box),
                );
                if (index === 3 && width === 1440)
                    await page.screenshot({ path: "verification/tour-desktop.png" });
                if (index === 9 && width === 390)
                    await page.screenshot({ path: "verification/tour-mobile.png" });
                if (index === tourSteps.length - 1) {
                    const failing = failSave;
                    await next.click();
                    if (failing) {
                        await dialog.getByRole("alert").waitFor();
                        assert.equal(
                            (await (await context.request.get(base + "/api/account/tour")).json())
                                .completed,
                            false,
                        );
                        await next.click();
                    }
                } else await next.click();
            }
            await dialog.waitFor({ state: "hidden" });
            assert.equal(await page.locator(".shell").evaluate((e) => e.inert), false);
        }
        await page.getByRole("button", { name: "Take a tour", exact: true }).click();
        await traverse(1440);
        assert.equal(
            (await (await context.request.get(base + "/api/account/tour")).json()).completed,
            true,
        );
        assert.ok(
            writes.length === 2 &&
                writes.every(
                    (r) =>
                        r.path === "/api/account/tour" &&
                        r.body === JSON.stringify({ completed: true }),
                ),
        );
        const after = await (await context.request.get(base + "/api/notebook")).json();
        assert.deepEqual(after.document, before.document);
        assert.equal(after.revision, before.revision);
        pass(
            "All 25 lessons and 11 exercises work; validation, Back/idempotence and completion-save retry pass",
        );
        pass(
            "Practice sends zero business/file/marketplace writes; only the completion flag is saved and real records remain unchanged",
        );
        for (const width of [390, 320]) {
            await page.setViewportSize({ width, height: 844 });
            await page.getByRole("button", { name: "Take a tour", exact: true }).click();
            await traverse(width);
            assert.ok(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            );
        }
        pass("Every lesson and practice form fits 320px/390px phones");
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.getByRole("button", { name: "Take a tour", exact: true }).click();
        for (let i = 0; i < 3; i++)
            await dialog
                .getByRole("button", { name: i === 0 ? "Let’s practice" : "Next", exact: true })
                .click();
        await dialog
            .getByLabel("Practice product name", { exact: true })
            .fill("Discard this practice");
        await dialog.getByRole("button", { name: "Apply practice step", exact: true }).click();
        await dialog.getByRole("button", { name: "Close tutorial", exact: true }).click();
        await page.getByRole("button", { name: "Take a tour", exact: true }).click();
        for (let i = 0; i < 3; i++)
            await dialog
                .getByRole("button", { name: i === 0 ? "Let’s practice" : "Next", exact: true })
                .click();
        assert.equal(
            await dialog.getByLabel("Practice product name", { exact: true }).inputValue(),
            "Practice everyday tote",
        );
        assert.equal(await dialog.locator(".tour-practice-result").count(), 0);
        await dialog.getByRole("button", { name: "Skip tour", exact: true }).click();
        pass(
            "Closing mid-practice discards fictional data; replay starts with a clean practice notebook",
        );
        await page.getByRole("button", { name: "Open account and sync settings" }).click();
        await page.getByRole("tab", { name: "Profile", exact: true }).click();
        await page.getByRole("button", { name: "Sign out", exact: true }).click();
        await page.waitForURL(base + "/");
        await page.locator(".landing").waitFor();
        assert.equal((await context.request.get(base + "/api/notebook/manifest")).status(), 401);
        assert.deepEqual(errors, []);
        pass("Profile sign-out and homepage rendering still work without browser runtime errors");
    } catch (error) {
        failure = error;
        console.error(error.stack || error);
        await page?.screenshot({ path: "verification/tour-failure.png" }).catch(() => {});
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
                console.error("Temporary test-account cleanup failed");
            }
        }
        fs.writeFileSync(
            "verification/tour-e2e.json",
            JSON.stringify(
                { passed: !failure, checks, failure: failure?.message || null },
                null,
                2,
            ),
        );
        process.exitCode = failure ? 1 : 0;
    }
})();
