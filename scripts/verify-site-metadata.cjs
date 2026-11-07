const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require("@playwright/test");

async function main() {
    const base = process.env.VERIFY_BASE_URL || "http://127.0.0.1:3200";
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage({ userAgent: "facebookexternalhit/1.1" });
        for (const path of ["/", "/terms", "/privacy"]) {
            const response = await page.goto(base + path);
            assert.equal(response.status(), 200);
            assert.equal(
                await page.locator('link[rel="canonical"]').getAttribute("href"),
                "https://ntbk.ajmission.dev" + (path === "/" ? "" : path),
            );
            assert.match(
                await page.locator('meta[name="robots"]').getAttribute("content"),
                /^index, follow$/,
            );
            assert.equal(
                await page.locator('meta[name="twitter:card"]').getAttribute("content"),
                "summary_large_image",
            );
            assert.ok(
                (
                    await page.locator('meta[property="og:image"]').getAttribute("content")
                ).startsWith("https://ntbk.ajmission.dev/opengraph-image"),
            );
            assert.equal(
                await page.locator('meta[property="og:url"]').getAttribute("content"),
                "https://ntbk.ajmission.dev" + (path === "/" ? "" : path),
            );
            if (path === "/") {
                const data = JSON.parse(
                    await page.locator('script[type="application/ld+json"]').textContent(),
                );
                assert.deepEqual(
                    data["@graph"].map((entry) => entry["@type"]),
                    ["WebSite", "WebApplication"],
                );
            }
        }
        for (const path of ["/auth/sign-in", "/auth/sign-up", "/account/delete"]) {
            await page.goto(base + path);
            assert.match(
                await page.locator('meta[name="robots"]').getAttribute("content"),
                /noindex/,
            );
            assert.equal(await page.locator('link[rel="canonical"]').count(), 0);
        }
        const sitemap = await (await fetch(base + "/sitemap.xml")).text();
        const locations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
        assert.deepEqual(
            locations,
            ["/", "/terms", "/privacy"].map((path) => "https://ntbk.ajmission.dev" + path),
        );
        const robots = await (await fetch(base + "/robots.txt")).text();
        for (const path of ["/api/", "/notebook", "/account", "/auth/"])
            assert.ok(robots.includes("Disallow: " + path));
        assert.ok(robots.includes("Sitemap: https://ntbk.ajmission.dev/sitemap.xml"));
        const image = await fetch(base + "/opengraph-image");
        assert.equal(image.status, 200);
        assert.match(image.headers.get("content-type"), /image\/png/);
        const bytes = Buffer.from(await image.arrayBuffer());
        assert.equal(bytes.readUInt32BE(16), 1200);
        assert.equal(bytes.readUInt32BE(20), 630);
        fs.mkdirSync("verification", { recursive: true });
        fs.writeFileSync("verification/social-preview.png", bytes);
        console.log(
            "Passed: public canonical/OG/Twitter tags, structured data, private-page noindex, sitemap, robots and 1200x630 share image.",
        );
    } finally {
        await browser.close();
    }
}
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
