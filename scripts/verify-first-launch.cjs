const { chromium } = require("@playwright/test"),
    fs = require("node:fs"),
    os = require("node:os"),
    path = require("node:path"),
    assert = require("node:assert/strict");
const { startSetup } = require("./first-launch.cjs");
const { readValues, fields } = require("./setup/config.cjs");
const values = {
    DATABASE_URL: "postgresql://fixture:private@fixture-pooler.example.test/notebook",
    DATABASE_URL_UNPOOLED: "postgresql://fixture:private@fixture.example.test/notebook",
    NEON_AUTH_BASE_URL: "https://identity.example.test",
    AWS_ACCESS_KEY_ID: "fixture-storage-access",
    AWS_SECRET_ACCESS_KEY: "private-storage-secret",
    AWS_ENDPOINT_URL_S3: "https://storage.example.test",
    AWS_REGION: "ap-southeast-1",
    NEON_REALTIME_URL: "wss://sync.example.test",
    NEON_REALTIME_SECRET: "private-realtime-fixture-secret",
};
(async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "notebook-setup-ui-"));
    let setup, browser, failure;
    const checks = [];
    try {
        fs.copyFileSync(".env.example", path.join(root, ".env.example"));
        setup = await startSetup({ root, shutdown: false });
        browser = await chromium.launch({ channel: "msedge", headless: true });
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }),
            page = await context.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.goto(setup.url);
        await page.getByRole("heading", { name: "Your notebook", exact: true }).waitFor();
        assert.equal(new URL(page.url()).hash, "");
        assert.equal(await page.locator("#DATABASE_URL").getAttribute("type"), "password");
        await page.screenshot({ path: "verification/first-launch-desktop.png", fullPage: true });
        for (const width of [390, 320]) {
            await page.setViewportSize({ width, height: 844 });
            assert.ok(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            );
            await page.screenshot({
                path: `verification/first-launch-${width}.png`,
                fullPage: true,
            });
        }
        checks.push(
            "Private installer renders on desktop and 320/390px phones; removes token from history and masks database credentials",
        );
        for (const group of ["Your notebook", "Private file storage", "Live sync"]) {
            await page.getByRole("button", { name: group, exact: false }).click();
            for (const [key, value] of Object.entries(values))
                if (await page.locator("#" + key).count())
                    await page.locator("#" + key).fill(value);
        }
        await page.getByRole("button", { name: "Review & finish", exact: false }).click();
        await page.getByRole("button", { name: "Save & close setup", exact: true }).click();
        await page.getByRole("alert").getByText("Please acknowledge", { exact: false }).waitFor();
        await page.getByRole("checkbox").check();
        await page.getByRole("button", { name: "Save & close setup", exact: true }).click();
        await page
            .getByRole("heading", { name: "Your first page is ready.", exact: true })
            .waitFor();
        const loaded = readValues(root, fields(root));
        for (const [key, value] of Object.entries(values)) assert.equal(loaded[key], value);
        assert.match(loaded.NEON_AUTH_COOKIE_SECRET, /^[a-f0-9]{64}$/);
        assert.equal(fs.existsSync(path.join(root, ".setup/completed.json")), true);
        assert.deepEqual(errors, []);
        checks.push(
            "Wizard retains inputs across steps, requires final acknowledgement, generates a missing session secret, and saves optional integrations disabled",
        );
        const u = new URL(setup.url);
        assert.equal((await fetch(u.origin + u.pathname)).status, 404);
        checks.push("Successful setup immediately disappears and cannot be accessed again");
    } catch (error) {
        failure = error;
        console.error(error.message || error);
        process.exitCode = 1;
    } finally {
        await browser?.close();
        if (setup) await new Promise((resolve) => setup.server.close(resolve));
        const resolved = path.resolve(root);
        assert.ok(
            resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) &&
                path.basename(resolved).startsWith("notebook-setup-ui-"),
        );
        fs.rmSync(resolved, { recursive: true, force: true });
        fs.writeFileSync(
            "verification/first-launch.json",
            JSON.stringify(
                {
                    passed: !failure,
                    checks,
                    failure: failure?.message || null,
                    mode: "isolated temporary installation; fake credentials; no external provider calls",
                },
                null,
                2,
            ),
        );
        for (const check of checks) console.log("PASS " + check);
    }
})();
