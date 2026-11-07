const { chromium } = require("@playwright/test");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
(async () => {
    const b = await chromium.launch({ channel: "msedge", headless: true });
    const c = await b.newContext({
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
        storageState: "promo/session.private.json",
        recordVideo: { dir: "promo/raw", size: { width: 1920, height: 1080 } },
    });
    const p = await c.newPage();
    const epoch = Date.now(),
        marks = [];
    const wait = (ms) => p.waitForTimeout(ms);
    async function shot(name, action) {
        await wait(700);
        const start = (Date.now() - epoch) / 1000;
        await action();
        await wait(4300);
        marks.push({ name, start, end: (Date.now() - epoch) / 1000 });
        console.log("Captured", name);
        await p.screenshot({ path: `promo/check-${name}.png` });
    }
    try {
        await p.goto("http://127.0.0.1:3000/notebook");
        await p.getByText("Live across your devices", { exact: true }).waitFor({ timeout: 60000 });
        await p.getByRole("button", { name: "Open account and sync settings" }).click();
        await p.getByRole("tab", { name: "Notebook", exact: true }).click();
        await p.getByRole("button", { name: "Explore sample notebook" }).click();
        await p
            .locator("#notebook-sidebar nav")
            .getByRole("button", { name: /Expenses/ })
            .click();
        await p.getByLabel("Filter expense category").waitFor();
        await p.evaluate(() => document.fonts.ready);
        await shot("expenses", async () => {
            await wait(650);
            await p.getByLabel("Filter expense category").selectOption("Software");
            await wait(500);
        });
        await p
            .locator("#notebook-sidebar nav")
            .getByRole("button", { name: /Suppliers/ })
            .click();
        await p.getByPlaceholder("Search suppliers or product SKUs…").waitFor();
        await shot("suppliers", async () => {
            await wait(550);
            await p
                .getByPlaceholder("Search suppliers or product SKUs…")
                .pressSequentially("studio 1", { delay: 100 });
            await wait(400);
        });
        await p.locator(".supplier-manager details > summary").first().click();
        await p.locator(".purchase-orders > summary").scrollIntoViewIfNeeded();
        await p.locator(".purchase-orders").evaluate((el) => el.scrollIntoView({ block: "start" }));
        await wait(500);
        await shot("deliveries", async () => {
            await wait(650);
            await p.getByLabel("Purchase status", { exact: true }).selectOption("Overdue");
            await wait(650);
        });
    } finally {
        await p.close();
        await c.close();
        await b.close();
    }
    const raw = await p.video().path();
    fs.writeFileSync(
        "promo/operations-capture-marks.json",
        JSON.stringify({ raw, marks }, null, 2),
    );
    for (const m of marks) {
        const r = spawnSync(
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
                `promo/public/${m.name}.mp4`,
            ],
            { encoding: "utf8" },
        );
        if (r.status !== 0) throw Error(r.stderr);
    }
    console.log("Recorded expenses, suppliers and deliveries at 1920×1080.");
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
