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
    let browser, failure;
    try {
        browser = await chromium.launch({ channel: "msedge", headless: true });
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
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
            await p.close();
            return user;
        }

        const user = await signup(context, "notebook-recovery"),
            { createSampleNotebook } = await import("../lib/sample-notebook.mjs"),
            { goodsReturn, addGoodsReturnRefund } = await import("../lib/supplier-returns.mjs"),
            { backupFingerprint, readNotebookBackup } = await import("../lib/notebook-backup.mjs");
        const document = createSampleNotebook(),
            p = document.products.find((p) => p.stock >= 5),
            supplier = document.suppliers[0],
            date = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
        const po = {
            id: crypto.randomUUID(),
            reference: "RESTORE-QA",
            supplierId: supplier.id,
            supplierName: supplier.name,
            status: "Received",
            createdAt: new Date().toISOString(),
            receivedAt: new Date().toISOString(),
            expectedDate: "",
            notes: "Private recovery fixture",
            items: [
                {
                    productId: p.id,
                    productName: p.name,
                    sku: p.sku,
                    quantity: 5,
                    receivedQuantity: 5,
                    unitCost: 100,
                },
            ],
            payments: [
                {
                    id: crypto.randomUUID(),
                    date,
                    amount: 500,
                    method: "Cash",
                    reference: "",
                    notes: "",
                },
            ],
            supplierRefunds: [],
        };
        const returned = goodsReturn(
            po,
            document.products,
            document.stockAdjustments,
            { items: [{ productId: p.id, quantity: 2 }], date, reason: "Recovery fixture" },
            crypto.randomUUID(),
        );
        document.products = returned.products;
        document.stockAdjustments = returned.stockAdjustments;
        document.purchaseOrders = [
            addGoodsReturnRefund(
                returned.order,
                { amount: 100, date, method: "Cash" },
                crypto.randomUUID(),
            ),
            ...document.purchaseOrders,
        ];
        const snapshot = async () =>
            await (await context.request.get(base + "/api/notebook")).json();
        async function put(doc, revision) {
            return context.request.put(base + "/api/notebook", {
                headers: { Origin: base, "X-Notebook-Restore": "true" },
                data: { document: doc, revision },
            });
        }
        let response = await put(document, 0);
        assert.equal(response.status(), 200, await response.text());
        let current = await snapshot();
        response = await context.request.get(
            base + "/api/notebook/backup?revision=" + current.revision,
        );
        assert.equal(response.status(), 200, await response.text());
        const checkpoint = await response.text(),
            saved = readNotebookBackup(checkpoint);
        assert.equal(backupFingerprint(saved.document), backupFingerprint(current.document));
        pass(
            "Server checkpoint includes all sample collections, physical returns, cash entries and linked stock history",
        );
        const empty = {
            products: [],
            orders: [],
            expenses: [],
            sidebarNote: "Recovery drill",
            branding: null,
            stockAdjustments: [],
            refundRecords: [],
            suppliers: [],
            purchaseOrders: [],
        };
        const oldRevision = current.revision;
        response = await put(empty, current.revision);
        assert.equal(response.status(), 200, await response.text());
        current = await snapshot();
        assert.equal(current.document.products.length, 0);
        assert.equal(current.document.purchaseOrders.length, 0);
        assert.equal((await put(saved.document, oldRevision)).status(), 409);
        assert.equal(
            (
                await context.request.get(base + "/api/notebook/backup?revision=" + oldRevision)
            ).status(),
            409,
        );
        response = await put(saved.document, current.revision);
        assert.equal(response.status(), 200, await response.text());
        current = await snapshot();
        assert.equal(backupFingerprint(current.document), backupFingerprint(saved.document));
        pass(
            "Whole-notebook replacement and checkpoint recovery reconcile every field; stale restore/export revisions reject",
        );
        const before = current.revision;
        response = await put(current.document, before);
        assert.equal(response.status(), 200, await response.text());
        assert.equal((await response.json()).revision, before);
        const corrupt = structuredClone(current.document);
        corrupt.stockAdjustments = corrupt.stockAdjustments.filter(
            (a) => a.id !== corrupt.purchaseOrders[0].goodsReturns[0].items[0].stockAdjustmentId,
        );
        response = await put(corrupt, before);
        assert.equal(response.status(), 400, await response.text());
        assert.equal((await snapshot()).revision, before);
        pass(
            "Identical restore is a no-op and invalid return audit links cannot partially overwrite saved data",
        );
        const page = await context.newPage();
        await page.goto(base + "/notebook");
        await page.getByText("Live across your devices", { exact: true }).waitFor();
        await page
            .getByRole("button", { name: "Open account and sync settings", exact: true })
            .click();
        await page.getByRole("tab", { name: "Notebook", exact: true }).click();
        await page.locator(".notebook-backup > summary").click();
        const choose = page.getByLabel("Choose notebook backup", { exact: true });
        await choose.setInputFiles({
            name: "corrupt.json",
            mimeType: "application/json",
            buffer: Buffer.from("{invalid"),
        });
        await page.getByRole("alert").filter({ hasText: "valid JSON notebook backup" }).waitFor();
        assert.equal(
            await page
                .getByRole("button", { name: "Restore reviewed backup", exact: true })
                .count(),
            0,
        );
        const edited = {
            ...JSON.parse(checkpoint),
            document: { ...saved.document, sidebarNote: "Restored through UI" },
        };
        await choose.setInputFiles({
            name: "restore.json",
            mimeType: "application/json",
            buffer: Buffer.from(JSON.stringify(edited)),
        });
        await page
            .getByLabel("I understand this replaces my current notebook data.", { exact: true })
            .check();
        const restore = page.getByRole("button", { name: "Restore reviewed backup", exact: true });
        assert.ok(await restore.isDisabled());
        await page
            .getByText("1 supplier goods returns (including voided entries)", { exact: true })
            .waitFor();
        for (const width of [320, 390, 768]) {
            await page.setViewportSize({ width, height: 844 });
            assert.ok(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            );
        }
        await page.setViewportSize({ width: 1440, height: 1000 });
        const download = page.waitForEvent("download");
        await page.getByRole("button", { name: "Download notebook backup", exact: true }).click();
        const downloaded = fs.readFileSync(await (await download).path(), "utf8");
        assert.equal(
            backupFingerprint(readNotebookBackup(downloaded).document),
            backupFingerprint(saved.document),
        );
        await restore.click();
        let dialog = page.getByRole("dialog", { name: "Please confirm", exact: true });
        await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
        assert.equal((await snapshot()).document.sidebarNote, saved.document.sidebarNote);
        await restore.click();
        dialog = page.getByRole("dialog", { name: "Please confirm", exact: true });
        const written = page.waitForResponse(
            (r) => r.url().endsWith("/api/notebook") && r.request().method() === "PUT",
        );
        await dialog.getByRole("button", { name: "Continue", exact: true }).click();
        response = await written;
        assert.equal(response.status(), 200, await response.text());
        current = await snapshot();
        assert.equal(current.document.sidebarNote, "Restored through UI");
        assert.equal(
            backupFingerprint({ ...current.document, sidebarNote: saved.document.sidebarNote }),
            backupFingerprint(saved.document),
        );
        pass(
            "Browser rejects corrupt files, requires a fresh checkpoint, honors Cancel and restores the reviewed document",
        );
        const anon = await browser.newContext();
        assert.equal(
            (await anon.request.get(base + "/api/notebook/backup?revision=0")).status(),
            401,
        );
        assert.equal(
            (
                await anon.request.put(base + "/api/notebook", {
                    data: { revision: 0, document: empty },
                })
            ).status(),
            401,
        );
        await anon.close();
        pass("Backup downloads and restore writes require authentication");
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
                .find((line) => line.includes("verify-backup-recovery.cjs")) || "",
        );
    } finally {
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
            "verification/backup-recovery-e2e.json",
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
