const { chromium } = require("@playwright/test");
const assert = require("node:assert/strict"),
    fs = require("node:fs");
const base = process.env.VERIFY_BASE_URL || "http://127.0.0.1:3000";
(async () => {
    const browser = await chromium.launch({ channel: "msedge", headless: true });
    const checks = [];
    try {
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }),
            page = await context.newPage(),
            errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        const previewAsset = await context.request.get(
            base + "/media/sellers-notebook-landing-poster.jpg",
        );
        assert.equal(previewAsset.status(), 200, "Preview must be public");
        assert.match(previewAsset.headers()["content-type"], /image\/jpeg/);
        await page.goto(base);
        assert.equal(await page.locator("video").count(), 0);
        const preview = page.locator(".landing-preview img");
        await preview.waitFor();
        assert.equal(
            await preview.evaluate((image) => image.complete && image.naturalWidth > 0),
            true,
        );
        checks.push("Public static preview; no video player");
        assert.equal(await page.locator(".landing-features > div").count(), 6);
        for (const text of [
            "The little costs count, too.",
            "Good people. Neatly kept.",
            "Find your pricing sweet spot.",
        ])
            assert.equal(await page.getByRole("heading", { name: text, exact: true }).count(), 1);
        checks.push("All six feature sections");
        await page.getByRole("link", { name: "Take a little look inside" }).click();
        assert.ok(page.url().endsWith("#inside-your-notebook"));
        assert.equal(
            await page
                .getByRole("link", { name: "Create your notebook", exact: true })
                .getAttribute("href"),
            "/auth/sign-up",
        );
        await page.screenshot({ path: "verification/homepage-desktop.png", fullPage: true });
        for (const width of [320, 390, 768, 1920]) {
            await page.setViewportSize({ width, height: 900 });
            assert.ok(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
                `Overflow at ${width}px`,
            );
            const box = await preview.boundingBox();
            assert.ok(box.width <= width);
            if (width === 390)
                await page.screenshot({ path: "verification/homepage-mobile.png", fullPage: true });
        }
        checks.push("No horizontal overflow at 320, 390, 768, 1440 and 1920px");
        const protectedPage = await context.request.get(base + "/notebook");
        assert.ok(protectedPage.url().includes("/auth/sign-in"));
        assert.equal((await context.request.get(base + "/api/notebook/manifest")).status(), 401);
        checks.push("Notebook and private API remain protected");
        assert.deepEqual(errors, []);
        checks.push("No browser runtime errors");
        fs.writeFileSync(
            "verification/homepage-e2e.json",
            JSON.stringify({ passed: true, checks }, null, 2),
        );
        console.log(checks.join("\n"));
    } finally {
        await browser.close();
    }
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
