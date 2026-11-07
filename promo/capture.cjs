const { chromium } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
(async () => {
    fs.mkdirSync("promo/raw", { recursive: true });
    fs.mkdirSync("promo/public", { recursive: true });
    const b = await chromium.launch({ channel: "msedge", headless: true });
    const c = await b.newContext({
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
        storageState: "promo/session.private.json",
        recordVideo: { dir: "promo/raw", size: { width: 1920, height: 1080 } },
    });
    const p = await c.newPage();
    const epoch = Date.now();
    const marks = [];
    const wait = (ms) => p.waitForTimeout(ms);
    const mark = async (name, action) => {
        await wait(500);
        const start = (Date.now() - epoch) / 1000;
        await action();
        await wait(1800);
        marks.push({ name, start, end: (Date.now() - epoch) / 1000 });
        console.log("Captured", name);
    };
    try {
        await p.goto("http://127.0.0.1:3000");
        await p.evaluate(() => document.fonts.ready);
        await wait(700);
        await mark("landing", async () => {
            await p.mouse.move(640, 688, { steps: 20 });
            await wait(1700);
        });
        await p.goto("http://127.0.0.1:3000/notebook");
        await p.getByText("Live across your devices", { exact: true }).waitFor({ timeout: 60000 });
        await p.getByRole("button", { name: "Open account and sync settings" }).click();
        await p.getByRole("tab", { name: "Notebook", exact: true }).click();
        await p.getByRole("button", { name: "Explore sample notebook" }).click();
        await p.getByText("Sample notebook · saved in this browser", { exact: true }).waitFor();
        await p.evaluate(() => document.fonts.ready);
        await mark("overview", async () => {
            await p.mouse.move(1100, 480, { steps: 25 });
            await wait(1900);
        });
        await p
            .locator("#notebook-sidebar nav")
            .getByRole("button", { name: /Inventory/ })
            .click();
        await p.getByPlaceholder("Search products…").waitFor();
        await mark("inventory", async () => {
            await wait(550);
            await p.getByPlaceholder("Search products…").pressSequentially("Tote", { delay: 150 });
            await wait(650);
        });
        await p
            .locator("#notebook-sidebar nav")
            .getByRole("button", { name: /Orders/ })
            .click();
        await p.getByLabel("Filter channel", { exact: true }).waitFor();
        await mark("orders", async () => {
            await wait(650);
            await p.getByLabel("Filter channel", { exact: true }).selectOption({ label: "Shopee" });
            await wait(1100);
        });
        await p
            .locator("#notebook-sidebar nav")
            .getByRole("button", { name: /Pricing calculator/ })
            .click();
        await p.getByLabel("Target profit margin (%)", { exact: true }).waitFor();
        await mark("pricing", async () => {
            await wait(500);
            await p.getByLabel("Target profit margin (%)", { exact: true }).fill("35");
            await p.getByLabel("Target profit margin (%)", { exact: true }).blur();
            await wait(1500);
        });
        await p.screenshot({ path: "promo/inspection-pricing.png" });
    } finally {
        await p.close();
        await c.close();
        await b.close();
    }
    const raw = await p.video().path();
    fs.writeFileSync("promo/capture-marks.json", JSON.stringify({ raw, marks }, null, 2));
    for (const m of marks) {
        const result = spawnSync(
            "ffmpeg",
            [
                "-y",
                "-ss",
                String(m.start),
                "-i",
                raw,
                "-t",
                String(m.end - m.start),
                "-an",
                "-vf",
                "fps=30",
                "-c:v",
                "libx264",
                "-crf",
                "16",
                "-preset",
                "fast",
                "-pix_fmt",
                "yuv420p",
                path.join("promo/public", m.name + ".mp4"),
            ],
            { encoding: "utf8" },
        );
        if (result.status !== 0) throw Error(result.stderr);
    }
    console.log("All five clips captured at 1920×1080.");
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
