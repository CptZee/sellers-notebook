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

        const user = await signup(context, "notebook-keyboard"),
            { createSampleNotebook } = await import("../lib/sample-notebook.mjs"),
            { createNotebookBackup } = await import("../lib/notebook-backup.mjs"),
            document = createSampleNotebook();
        let response = await context.request.put(base + "/api/notebook", {
            headers: { Origin: base },
            data: { revision: 0, document },
        });
        assert.equal(response.status(), 200, await response.text());
        const page = await context.newPage();
        await page.goto(base + "/notebook");
        await page.getByText("Live across your devices", { exact: true }).waitFor();
        const opener = page.getByRole("button", {
            name: "Open account and sync settings",
            exact: true,
        });
        await opener.focus();
        await page.keyboard.press("Enter");
        const account = page.getByRole("dialog", { name: "Account settings", exact: true });
        await account.waitFor();
        assert.ok(await page.locator(".shell").evaluate((el) => el.inert));
        assert.equal(await page.evaluate(() => document.body.style.overflow), "hidden");
        assert.ok(await account.evaluate((el) => el.contains(document.activeElement)));
        async function assertTrap(dialog) {
            await dialog.evaluate((el) => {
                const controls = Array.from(
                    el.querySelectorAll("button,input,select,textarea,summary,a[href],[tabindex]"),
                ).filter(
                    (e) =>
                        e.tabIndex >= 0 &&
                        !e.matches(":disabled") &&
                        !e.closest("[inert]") &&
                        e.getClientRects().length,
                );
                controls[0].focus();
            });
            await page.keyboard.press("Shift+Tab");
            assert.ok(
                await dialog.evaluate((el) => {
                    const controls = Array.from(
                        el.querySelectorAll(
                            "button,input,select,textarea,summary,a[href],[tabindex]",
                        ),
                    ).filter(
                        (e) =>
                            e.tabIndex >= 0 &&
                            !e.matches(":disabled") &&
                            !e.closest("[inert]") &&
                            e.getClientRects().length,
                    );
                    return document.activeElement === controls.at(-1);
                }),
            );
            await page.keyboard.press("Tab");
            assert.ok(
                await dialog.evaluate(
                    (el) => document.activeElement === el.querySelector("button"),
                ),
            );
            for (let i = 0; i < 18; i++) {
                await page.keyboard.press("Tab");
                assert.ok(await dialog.evaluate((el) => el.contains(document.activeElement)));
            }
        }
        await assertTrap(account);
        await page.keyboard.press("Escape");
        await account.waitFor({ state: "hidden" });
        assert.ok(await opener.evaluate((el) => el === document.activeElement));
        assert.equal(await page.locator(".shell").evaluate((el) => el.inert), false);
        assert.notEqual(await page.evaluate(() => document.body.style.overflow), "hidden");
        pass(
            "Account dialog locks the background, contains forward/reverse Tab, closes on Escape and returns focus to its opener",
        );
        await opener.press("Enter");
        await account.waitFor();
        const profile = page.getByRole("tab", { name: "Profile", exact: true });
        await profile.focus();
        await page.keyboard.press("ArrowRight");
        await page.getByRole("tab", { name: "Branding", exact: true }).evaluate((el) => {
            if (el !== document.activeElement || el.getAttribute("aria-selected") !== "true")
                throw Error("Branding tab not selected/focused");
        });
        await page.keyboard.press("End");
        assert.ok(
            await page
                .getByRole("tab", { name: "Notebook", exact: true })
                .evaluate((el) => el === document.activeElement),
        );
        await page.keyboard.press("Home");
        assert.ok(await profile.evaluate((el) => el === document.activeElement));
        await page.keyboard.press("ArrowLeft");
        assert.ok(
            await page
                .getByRole("tab", { name: "Notebook", exact: true })
                .evaluate((el) => el === document.activeElement),
        );
        await assertTrap(account);
        pass(
            "Account tabs support arrows, Home and End while inactive tabs stay outside the Tab sequence",
        );
        await page.locator(".notebook-backup > summary").click();
        await page.getByLabel("Choose notebook backup", { exact: true }).setInputFiles({
            name: "fixture.json",
            mimeType: "application/json",
            buffer: Buffer.from(createNotebookBackup(document)),
        });
        const download = page.waitForEvent("download");
        await page.getByRole("button", { name: "Download notebook backup", exact: true }).click();
        await download;
        await page
            .getByLabel("I understand this replaces my current notebook data.", { exact: true })
            .check();
        const restore = page.getByRole("button", { name: "Restore reviewed backup", exact: true });
        await restore.focus();
        await page.keyboard.press("Enter");
        const confirmation = page.getByRole("dialog", { name: "Please confirm", exact: true });
        await confirmation.waitFor();
        assert.ok(await account.evaluate((el) => el.closest(".modal-backdrop").inert));
        await assertTrap(confirmation);
        await page.keyboard.press("Escape");
        await confirmation.waitFor({ state: "hidden" });
        assert.ok(await account.isVisible());
        assert.equal(await account.evaluate((el) => el.closest(".modal-backdrop").inert), false);
        assert.ok(await restore.evaluate((el) => el === document.activeElement));
        assert.ok(await page.locator(".shell").evaluate((el) => el.inert));
        pass(
            "Nested confirmation takes keyboard focus exclusively; Escape dismisses only the top dialog and restores parent focus",
        );
        for (const width of [320, 390, 768]) {
            await page.setViewportSize({ width, height: 844 });
            assert.ok(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            );
            await assertTrap(account);
        }
        await page.getByRole("button", { name: "Close account", exact: true }).click();
        assert.equal(await page.locator(".shell").evaluate((el) => el.inert), false);
        pass(
            "Account and nested-dialog focus behavior fits phone/tablet widths and unlocks after closing",
        );
        await page.setViewportSize({ width: 1440, height: 1000 });
        const fab = page.getByRole("button", { name: "Quick create", exact: true });
        await fab.focus();
        await page.keyboard.press("Enter");
        await page
            .getByRole("group", { name: "Create a new entry", exact: true })
            .getByRole("button", { name: "New supplier", exact: true })
            .press("Enter");
        const supplierDialog = page.getByRole("dialog", { name: "New supplier", exact: true });
        await supplierDialog.waitFor();
        await page.getByLabel("Supplier notes", { exact: true }).focus();
        await page.keyboard.press("Tab");
        assert.ok(await supplierDialog.evaluate((el) => el.contains(document.activeElement)));
        await assertTrap(supplierDialog);
        await page.keyboard.press("Escape");
        await supplierDialog.waitFor({ state: "hidden" });
        assert.ok(await fab.evaluate((el) => el === document.activeElement));
        assert.equal(await page.locator(".shell").evaluate((el) => el.inert), false);
        pass(
            "Shared supplier entry includes textarea controls in its focus loop and returns focus to the FAB after Escape",
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
                .find((line) => line.includes("verify-keyboard.cjs")) || "",
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
            "verification/keyboard-e2e.json",
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
