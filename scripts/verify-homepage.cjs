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
        const asset = await context.request.get(base + "/media/sellers-notebook-landing-loop.mp4");
        assert.equal(asset.status(), 200, "Preview must be public");
        assert.match(asset.headers()["content-type"], /video\/mp4/);
        assert.ok((await asset.body()).length < 5000000);
        checks.push("Public MP4 and poster");
        const poster = await context.request.get(
            base + "/media/sellers-notebook-landing-poster.jpg",
        );
        assert.equal(poster.status(), 200);
        assert.match(poster.headers()["content-type"], /image\/jpeg/);
        await page.goto(base);
        await page.locator("video").waitFor();
        await page.waitForFunction(
            () => {
                const v = document.querySelector("video");
                return v.readyState >= 3 && !v.paused && v.currentTime > 0.3;
            },
            { timeout: 30000 },
        );
        const video = page.locator("video");
        assert.deepEqual(
            await video.evaluate((v) => ({
                muted: v.muted,
                loop: v.loop,
                inline: v.playsInline,
                controls: v.controls,
                width: v.videoWidth,
                height: v.videoHeight,
            })),
            { muted: true, loop: true, inline: true, controls: true, width: 1920, height: 1080 },
        );
        checks.push("Muted inline autoplay with controls at 1920×1080");
        await video.evaluate((v) => {
            v.currentTime = v.duration - 0.15;
        });
        await page.waitForFunction(() => document.querySelector("video").currentTime < 2);
        checks.push("Playback loops");
        await video.evaluate((v) => v.pause());
        assert.equal(await video.evaluate((v) => v.paused), true);
        checks.push("Playback can pause");
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
            const box = await video.boundingBox();
            assert.ok(box.width <= width);
            if (width === 390)
                await page.screenshot({ path: "verification/homepage-mobile.png", fullPage: true });
        }
        checks.push("No horizontal overflow at 320, 390, 768, 1440 and 1920px");
        const reduced = await browser.newContext({
                viewport: { width: 390, height: 844 },
                reducedMotion: "reduce",
            }),
            rp = await reduced.newPage();
        await rp.goto(base);
        await rp.locator("video").waitFor();
        await rp.waitForTimeout(800);
        assert.equal(await rp.locator("video").evaluate((v) => v.paused && !v.autoplay), true);
        await rp.locator("video").evaluate((v) => v.play());
        await rp.waitForFunction(() => document.querySelector("video").currentTime > 0);
        checks.push("Reduced motion disables autoplay and allows manual play");
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
