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
    let browser, failure, context, fileId;
    try {
        browser = await chromium.launch({ channel: "msedge", headless: true });
        context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
        context.setDefaultTimeout(15000);
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
            assert.equal(
                (
                    await ctx.request.post(base + "/api/account/tour", {
                        headers: { Origin: base },
                        data: { completed: true },
                    })
                ).status(),
                200,
            );
            await p.close();
            return user;
        }
        console.log("CHECK signing up");
        const user = await signup(context, "notebook-records"),
            { createSampleNotebook } = await import("../lib/sample-notebook.mjs"),
            document = createSampleNotebook();
        let response = await context.request.put(base + "/api/notebook", {
            headers: { Origin: base },
            data: { revision: 0, document },
        });
        assert.equal(response.status(), 200, await response.text());
        let revision = (await response.json()).revision;
        console.log("CHECK opening file picker");
        const page = await context.newPage(),
            reads = [];
        page.on("request", (r) => {
            if (r.method() === "GET") reads.push(r.url());
        });
        await page.goto(base + "/notebook");
        await page
            .locator("#notebook-sidebar nav")
            .getByRole("button", { name: /^Inventory/ })
            .click();
        if (!(await page.locator("#product-attachments").evaluate((el) => el.open)))
            await page.locator("#product-attachments > summary").click();
        assert.equal(await page.locator(".inventory-tools").count(), 0);
        const panel = page.locator("#product-attachments");
        await page
            .getByLabel("Find a product for files", { exact: true })
            .fill(document.products[105].sku);
        await page
            .getByLabel("Files for inventory item", { exact: true })
            .selectOption(document.products[105].id);
        await panel
            .getByText("New uploads will be linked to this product.", { exact: false })
            .waitFor();
        console.log("CHECK uploading linked file");
        const uploaded = page.waitForResponse(
            (r) =>
                new URL(r.url()).pathname === "/api/attachments" && r.request().method() === "POST",
        );
        await page.getByLabel("Attach a file", { exact: true }).setInputFiles({
            name: "targeted-file.txt",
            mimeType: "text/plain",
            buffer: Buffer.from("Private file picker fixture"),
        });
        response = await uploaded;
        console.log("CHECK upload status", response.status());
        assert.equal(response.status(), 201);
        const listing = await context.request.get(base + "/api/attachments");
        fileId = (await listing.json()).attachments.find(
            (f) => f.filename === "targeted-file.txt",
        ).id;
        await panel.getByRole("link", { name: "targeted-file.txt", exact: true }).waitFor();
        assert.equal(
            await panel.getByLabel("Files for inventory item", { exact: true }).inputValue(),
            document.products[105].id,
        );
        let files = (await (await context.request.get(base + "/api/attachments")).json())
            .attachments;
        assert.equal(files.find((f) => f.id === fileId).productId, document.products[105].id);
        assert.equal(files.find((f) => f.id === fileId).productName, document.products[105].name);
        pass(
            "File picker searches off-page inventory, preserves selection and uploads privately to the chosen product without hydration",
        );
        await page.getByLabel("Files for inventory item", { exact: true }).selectOption("");
        await page
            .getByLabel("Find a product for files", { exact: true })
            .fill(document.products[106].sku);
        const linked = page.waitForResponse(
            (r) =>
                r.url().endsWith("/api/attachments/" + fileId) && r.request().method() === "PATCH",
        );
        await page
            .getByLabel("Linked product for targeted-file.txt", { exact: true })
            .selectOption(document.products[106].id);
        assert.equal((await linked).status(), 200);
        files = (await (await context.request.get(base + "/api/attachments")).json()).attachments;
        assert.equal(files.find((f) => f.id === fileId).productId, document.products[106].id);
        await page
            .getByLabel("Find a product for files", { exact: true })
            .fill("no matching product");
        assert.equal(
            await page
                .getByLabel("Linked product for targeted-file.txt", { exact: true })
                .inputValue(),
            document.products[106].id,
        );
        const unlinked = page.waitForResponse(
            (r) =>
                r.url().endsWith("/api/attachments/" + fileId) && r.request().method() === "PATCH",
        );
        await page
            .getByLabel("Linked product for targeted-file.txt", { exact: true })
            .selectOption("");
        assert.equal((await unlinked).status(), 200);
        assert.equal(
            await (await context.request.get(base + "/api/attachments/" + fileId)).text(),
            "Private file picker fixture",
        );
        assert.ok(!reads.some((url) => url.includes("/pages?")));
        pass(
            "Relinking across product searches and unlinking preserve file bytes and do not hydrate business collections",
        );
        const state = await (await context.request.get(base + "/api/notebook")).json();
        assert.deepEqual(state.document, document);
        assert.equal(state.revision, revision);
        pass(
            "File actions leave all inventory, sales, expenses, histories and notebook revision unchanged",
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
                .find((line) => line.includes("verify-file-tools.cjs")) || "",
        );
    } finally {
        if (fileId && context)
            await context.request
                .delete(base + "/api/attachments/" + fileId, { headers: { Origin: base } })
                .catch(() => {});
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
            "verification/file-tools-e2e.json",
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
