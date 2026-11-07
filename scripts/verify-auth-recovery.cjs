const { chromium } = require("@playwright/test"),
    assert = require("node:assert/strict"),
    fs = require("node:fs");
const base = "http://127.0.0.1:3000",
    checks = [];
const pass = (message) => {
    checks.push(message);
    console.log("PASS " + message);
};
(async () => {
    let browser, failure;
    try {
        browser = await chromium.launch({ channel: "msedge", headless: true });
        const context = await browser.newContext(),
            page = await context.newPage(),
            calls = [];
        let resetFails = true,
            verifyFails = true;
        // Isolate UI contracts: no account changes and no email delivery requests leave this browser.
        await context.route("**/api/auth/**", async (route) => {
            const request = route.request(),
                pathname = new URL(request.url()).pathname;
            if (request.method() !== "POST") return route.continue();
            const body = request.postDataJSON();
            calls.push({ pathname, body });
            let status = 200,
                json = { status: true };
            if (pathname.endsWith("/reset-password") && resetFails) {
                status = 400;
                json = {
                    code: "INVALID_TOKEN",
                    message: "This reset link has expired. Request a new link.",
                };
            }
            if (pathname.endsWith("/email-otp/verify-email") && verifyFails) {
                status = 400;
                json = { code: "INVALID_OTP", message: "That verification code has expired." };
            }
            await route.fulfill({
                status,
                contentType: "application/json",
                body: JSON.stringify(json),
            });
        });
        for (const path of [
            "/auth/reset-password",
            "/auth/reset-password?error=INVALID_TOKEN",
            "/auth/reset-password?token=fixture&error=INVALID_TOKEN",
        ]) {
            await page.goto(base + path);
            await page
                .getByRole("alert")
                .filter({ hasText: "This reset link is missing or invalid" })
                .waitFor();
            assert.equal(await page.getByLabel("Password", { exact: true }).count(), 0);
            assert.ok(
                (await page
                    .getByRole("link", { name: "Request a new reset link", exact: true })
                    .count()) > 0,
            );
        }
        pass(
            "Missing and provider-rejected reset links show recovery instructions without a password form",
        );
        await page.goto(base + "/auth/reset-password?token=fixture-token");
        await page.getByLabel("Password", { exact: true }).fill("NewPassword-123");
        await page.getByLabel("Confirm password", { exact: true }).fill("DifferentPassword-123");
        await page.getByRole("button", { name: "Save new password", exact: true }).click();
        await page.getByRole("alert").filter({ hasText: "Passwords do not match" }).waitFor();
        assert.equal(calls.length, 0);
        await page.getByLabel("Confirm password", { exact: true }).fill("NewPassword-123");
        await page.getByRole("button", { name: "Save new password", exact: true }).click();
        await page.getByRole("alert").filter({ hasText: "expired" }).waitFor();
        assert.equal(
            await page.getByLabel("Password", { exact: true }).inputValue(),
            "NewPassword-123",
        );
        assert.deepEqual(calls.at(-1).body, {
            newPassword: "NewPassword-123",
            token: "fixture-token",
        });
        resetFails = false;
        await page.getByRole("button", { name: "Save new password", exact: true }).click();
        await page.getByRole("status").filter({ hasText: "Password updated" }).waitFor();
        assert.equal(await page.getByLabel("Password", { exact: true }).count(), 0);
        assert.equal(new URL(page.url()).search, "");
        pass(
            "Reset requires matching passwords, retains failed draft, sends token and clears token/form after success",
        );
        await page.goto(base + "/auth/forgot-password");
        await page
            .getByLabel("Email address", { exact: true })
            .fill("recovery-fixture@example.com");
        await page.getByRole("button", { name: "Send reset link", exact: true }).click();
        await page
            .getByRole("status")
            .filter({ hasText: "If this email has an account" })
            .waitFor();
        assert.equal(calls.at(-1).body.redirectTo, base + "/auth/reset-password");
        pass("Forgot password uses the local reset callback and a neutral confirmation");
        await page.goto(base + "/auth/verify-email");
        await page.getByRole("button", { name: "Send or resend code", exact: true }).click();
        await page
            .getByRole("alert")
            .filter({ hasText: "Enter your email address first" })
            .waitFor();
        await page
            .getByLabel("Email address", { exact: true })
            .fill("recovery-fixture@example.com");
        await page.getByRole("button", { name: "Send or resend code", exact: true }).click();
        await page.getByRole("status").filter({ hasText: "code is on its way" }).waitFor();
        const count = calls.length;
        await page.getByRole("button", { name: "Send or resend code", exact: true }).click();
        await page.getByRole("alert").filter({ hasText: "Wait a minute" }).waitFor();
        assert.equal(calls.length, count);
        await page.getByLabel("Verification code", { exact: true }).fill("123456");
        await page.getByRole("button", { name: "Verify email", exact: true }).click();
        await page.getByRole("alert").filter({ hasText: "code has expired" }).waitFor();
        assert.equal(
            await page.getByLabel("Verification code", { exact: true }).inputValue(),
            "123456",
        );
        verifyFails = false;
        await page.getByRole("button", { name: "Verify email", exact: true }).click();
        await page.getByRole("status").filter({ hasText: "Email verified" }).waitFor();
        assert.equal(await page.getByLabel("Verification code", { exact: true }).count(), 0);
        pass(
            "Verification validates email, limits resends, retains expired-code drafts and confirms success",
        );
        for (const path of [
            "sign-up",
            "sign-in",
            "forgot-password",
            "reset-password?token=fixture",
            "verify-email",
        ])
            for (const width of [320, 390, 768]) {
                await page.setViewportSize({ width, height: 844 });
                await page.goto(base + "/auth/" + path);
                assert.ok(
                    await page.evaluate(
                        () => document.documentElement.scrollWidth <= innerWidth + 1,
                    ),
                );
            }
        pass("Account forms fit phone and tablet widths");
    } catch (error) {
        failure = error;
        console.error("FAIL", String(error.message).split("\n")[0]);
    } finally {
        await browser?.close();
        fs.writeFileSync(
            "verification/auth-recovery-e2e.json",
            JSON.stringify(
                {
                    passed: !failure,
                    mode: "mocked auth responses; no emails sent or accounts changed",
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
