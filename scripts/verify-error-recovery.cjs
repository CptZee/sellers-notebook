// Builds a disposable Next fixture using the real fallback components. No Auth or database access.
const fs = require("node:fs"),
    path = require("node:path"),
    assert = require("node:assert/strict"),
    { spawn } = require("node:child_process"),
    { chromium } = require("@playwright/test");
const root = process.cwd(),
    fixture = path.join(root, ".next", "error-recovery-fixture"),
    next = path.join(root, "node_modules", "next", "dist", "bin", "next"),
    base = "http://127.0.0.1:3002",
    checks = [];
const pass = (name) => {
    checks.push(name);
    console.log("PASS " + name);
};
function write(file, text) {
    const target = path.join(fixture, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
}
function start(args) {
    const child = spawn(process.execPath, [next, ...args], {
        cwd: fixture,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (data) => {
        output = (output + data).slice(-12000);
    });
    child.stderr.on("data", (data) => {
        output = (output + data).slice(-12000);
    });
    return { child, output: () => output };
}
async function exited(child) {
    return new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("exit", (code) => resolve(code));
    });
}
(async () => {
    let server, browser, failure;
    try {
        fs.mkdirSync(fixture, { recursive: true });
        write(
            "package.json",
            JSON.stringify({
                name: "notebook-error-recovery-fixture",
                private: true,
                dependencies: {
                    next: require("next/package.json").version,
                    react: require("react/package.json").version,
                    "react-dom": require("react-dom/package.json").version,
                },
            }),
        );
        write("next.config.js", `module.exports={distDir:'.fixture-build',experimental:{cpus:2}};`);
        for (const file of [
            "app/error.tsx",
            "app/global-error.tsx",
            "components/error-recovery.tsx",
        ])
            write(file, fs.readFileSync(path.join(root, file), "utf8"));
        write(
            "app/layout.tsx",
            `import {cookies} from 'next/headers';export default async function Layout({children}:{children:React.ReactNode}){if((await cookies()).get('qa-root-error')?.value==='yes')throw Error('FIXTURE_PRIVATE_ROOT_ERROR');return <html lang="en"><body>{children}</body></html>}`,
        );
        write(
            "app/page.tsx",
            `import {cookies} from 'next/headers';export const dynamic='force-dynamic';export default async function Page(){if((await cookies()).get('qa-recovered')?.value!=='yes')throw Error('FIXTURE_PRIVATE_SERVER_ERROR');return <h1>Server recovered</h1>}`,
        );
        write(
            "app/client/page.tsx",
            `'use client';export default function Page(){if(typeof window!=='undefined'&&sessionStorage.getItem('qa-client-recovered')!=='yes')throw Error('FIXTURE_PRIVATE_CLIENT_ERROR');return <h1>Client recovered</h1>}`,
        );
        const build = start(["build", "--webpack"]);
        const code = await exited(build.child);
        if (code !== 0) throw Error("Fixture build failed: " + build.output().slice(-1800));
        pass("Isolated production fixture builds with the installed Next error/retry contract");
        server = start(["start", "--hostname", "127.0.0.1", "--port", "3002"]);
        let listening = false;
        for (let i = 0; i < 100; i++) {
            try {
                await fetch(base);
                listening = true;
                break;
            } catch {
                await new Promise((resolve) => setTimeout(resolve, 200));
            }
        }
        assert.ok(listening, "Fixture server did not start");
        browser = await chromium.launch({ channel: "msedge", headless: true });
        const context = await browser.newContext(),
            page = await context.newPage();
        await page.goto(base);
        const heading = page.getByRole("heading", { name: "Let’s reopen this page.", exact: true });
        await heading.waitFor();
        assert.ok(await heading.evaluate((el) => el === document.activeElement));
        assert.ok(!(await page.locator("body").innerText()).includes("FIXTURE_PRIVATE"));
        await context.addCookies([{ name: "qa-recovered", value: "yes", url: base }]);
        await page.getByRole("button", { name: "Try again", exact: true }).click();
        await page.getByRole("heading", { name: "Server recovered", exact: true }).waitFor();
        pass(
            "Server render failures show a focused recovery screen and retry re-fetches the recovered route",
        );
        await page.goto(base + "/client");
        await heading.waitFor();
        assert.ok(!(await page.locator("body").innerText()).includes("FIXTURE_PRIVATE_CLIENT"));
        await page.evaluate(() => sessionStorage.setItem("qa-client-recovered", "yes"));
        await page.getByRole("button", { name: "Try again", exact: true }).click();
        await page.getByRole("heading", { name: "Client recovered", exact: true }).waitFor();
        pass("Client render failures recover without displaying raw error details");
        await page.evaluate(() => localStorage.setItem("notebook-theme", "dark"));
        await context.addCookies([{ name: "qa-root-error", value: "yes", url: base }]);
        await page.goto(base);
        await heading.waitFor();
        await page.waitForFunction(() => document.documentElement.dataset.theme === "dark");
        assert.equal(await page.title(), "Reopen your notebook — Seller’s Notebook");
        assert.ok(!(await page.locator("body").innerText()).includes("FIXTURE_PRIVATE_ROOT"));
        await page.getByRole("button", { name: "Try again", exact: true }).focus();
        await page.keyboard.press("Tab");
        assert.ok(
            await page
                .getByRole("link", { name: "Back to home", exact: true })
                .evaluate((el) => el === document.activeElement),
        );
        for (const width of [320, 390, 768]) {
            await page.setViewportSize({ width, height: 844 });
            assert.ok(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            );
        }
        pass(
            "Root layout fallback owns its document, preserves dark theme, supports keyboard actions and fits mobile widths",
        );
        await context.clearCookies({ name: "qa-root-error" });
        await page.getByRole("link", { name: "Back to home", exact: true }).click();
        await page.getByRole("heading", { name: "Server recovered", exact: true }).waitFor();
        pass("Home action exits the fallback after the underlying root failure is resolved");
    } catch (error) {
        failure = error;
        console.error("FAIL", String(error.message).split("\n")[0]);
    } finally {
        await browser?.close();
        if (server) {
            server.child.kill();
            await new Promise((resolve) =>
                server.child.exitCode !== null ? resolve() : server.child.once("exit", resolve),
            );
        }
        fs.writeFileSync(
            path.join(root, "verification/error-recovery-e2e.json"),
            JSON.stringify(
                {
                    passed: !failure,
                    mode: "isolated production fixture; no account or database changes",
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
