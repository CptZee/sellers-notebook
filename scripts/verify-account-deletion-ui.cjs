const { chromium } = require("@playwright/test"),
    assert = require("node:assert/strict"),
    fs = require("node:fs");
const base = "http://127.0.0.1:3000";
(async () => {
    let browser, failure;
    try {
        browser = await chromium.launch({ channel: "msedge", headless: true });
        const context = await browser.newContext(),
            page = await context.newPage();
        let prepared = 0,
            paused = false,
            step = 0;
        await page.route("**/api/account/deletion", async (route) => {
            const request = route.request();
            let body = { available: true, email: "disposable@example.com" },
                status = 200;
            if (request.method() === "POST") {
                prepared++;
                if (request.postDataJSON().password !== "fixture-password") {
                    status = 400;
                    body = { error: "Could not verify your password. Check it and retry." };
                } else
                    body = {
                        id: "12345678-1234-4234-8234-123456789012",
                        token: "a".repeat(43),
                        phase: "files",
                    };
            }
            if (request.method() === "DELETE") {
                if (!paused) {
                    paused = true;
                    status = 503;
                    body = { error: "Simulated deletion pause" };
                } else
                    body = {
                        phase: ["files", "records", "identity", "complete"][Math.min(step++, 3)],
                    };
            }
            await route.fulfill({
                status,
                contentType: "application/json",
                body: JSON.stringify(body),
            });
        });
        await page.goto(base + "/account/delete");
        await page.getByLabel("Current password", { exact: true }).waitFor();
        for (const width of [320, 390, 768]) {
            await page.setViewportSize({ width, height: 844 });
            assert.ok(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            );
        }
        await page.getByLabel("Current password", { exact: true }).fill("wrong-password");
        await page.getByLabel("Type DELETE to confirm", { exact: true }).fill("DELETE");
        await page
            .getByLabel("I understand this is permanent and have saved anything I need.", {
                exact: true,
            })
            .check();
        const confirm = async () => {
            await page
                .getByRole("button", { name: "Permanently delete account", exact: true })
                .click();
            const dialog = page.getByRole("dialog", { name: "Please confirm", exact: true });
            await dialog.waitFor();
            assert.ok(await page.locator("[data-modal-root]").evaluate((el) => el.inert));
            return dialog;
        };
        await (await confirm()).getByRole("button", { name: "Continue", exact: true }).click();
        await page
            .getByRole("alert")
            .filter({ hasText: "Could not verify your password" })
            .waitFor();
        assert.equal(
            await page.getByLabel("Current password", { exact: true }).inputValue(),
            "wrong-password",
        );
        await page.getByLabel("Current password", { exact: true }).fill("fixture-password");
        await (await confirm()).getByRole("button", { name: "Cancel", exact: true }).click();
        assert.equal(prepared, 1);
        await (await confirm()).getByRole("button", { name: "Continue", exact: true }).click();
        await page.getByRole("alert").filter({ hasText: "Simulated deletion pause" }).waitFor();
        assert.ok(await page.evaluate(() => !!sessionStorage.getItem("notebook-account-deletion")));
        await page.reload();
        await page
            .getByRole("heading", { name: "Your notebook is closed.", exact: true })
            .waitFor();
        assert.equal(
            await page.evaluate(() => sessionStorage.getItem("notebook-account-deletion")),
            null,
        );
        console.log(
            "PASS deletion UI supports mobile widths, private confirmation, wrong-password draft retention, Cancel, paused receipt recovery after reload and completion",
        );
    } catch (error) {
        failure = error;
        console.error("FAIL", String(error.message).split("\n")[0]);
    } finally {
        await browser?.close();
        fs.writeFileSync(
            "verification/account-deletion-ui.json",
            JSON.stringify(
                {
                    passed: !failure,
                    mode: "simulated API responses; no account changes",
                    failure: failure ? String(failure.message).split("\n")[0] : null,
                },
                null,
                2,
            ),
        );
    }
    process.exitCode = failure ? 1 : 0;
})();
