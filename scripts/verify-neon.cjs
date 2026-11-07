/* Run against a started production app: npm run verify:neon. Uses real Neon services. */
const { chromium } = require("@playwright/test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { promisify } = require("node:util");
const execFile = promisify(require("node:child_process").execFile);
require("@next/env").loadEnvConfig(process.cwd());

const base = process.env.NEON_E2E_BASE_URL || "http://127.0.0.1:3000";
const checks = [],
    users = [],
    errors = [];
let browser, ownerContext, attachmentId;
const pass = (name) => {
    checks.push(name);
    console.log(`PASS ${name}`);
};
const origin = { Origin: base };
const waitForSave = async (page) => {
    const r = await page.waitForResponse(
        (r) =>
            (r.url().endsWith("/api/notebook") ||
                r.url().endsWith("/api/notebook/record") ||
                r.url().endsWith("/api/notebook/order") ||
                r.url().endsWith("/api/notebook/purchase") ||
                r.url().endsWith("/api/notebook/stock")) &&
            ["PUT", "PATCH", "POST"].includes(r.request().method()),
    );
    assert.equal(r.status(), 200, await r.text());
    return r;
};
async function signIn(page, email, password) {
    await page.goto(base + "/auth/sign-in");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(base + "/notebook");
    await page.getByText("Live across your devices", { exact: true }).waitFor({ timeout: 30000 });
}
async function respondToConfirmation(page, accept = true) {
    const dialog = page.getByRole("dialog", { name: "Please confirm", exact: true });
    await dialog.waitFor();
    await dialog.getByRole("button", { name: accept ? "Continue" : "Cancel", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
}
let confirmationResponse;
async function run() {
    browser = await chromium.launch(
        process.platform === "win32" ? { channel: "msedge", headless: true } : { headless: true },
    );
    const anon = await browser.newContext();
    const publicPage = await anon.newPage();
    assert.equal((await anon.request.get(base + "/api/notebook")).status(), 401);
    assert.equal((await anon.request.get(base + "/api/realtime")).status(), 401);
    assert.equal((await anon.request.get(base + "/api/attachments")).status(), 401);
    assert.equal((await anon.request.get(base + "/api/shopee")).status(), 401);
    assert.equal((await anon.request.get(base + "/api/profile-picture")).status(), 401);
    assert.equal(
        (await anon.request.put(base + "/api/profile-picture", { headers: origin })).status(),
        401,
    );
    assert.equal(
        (await anon.request.post(base + "/api/shopee/connect", { headers: origin })).status(),
        401,
    );
    assert.equal(
        (
            await anon.request.post(base + "/api/shopee/orders", { headers: origin, data: {} })
        ).status(),
        401,
    );
    for (const platform of ["lazada", "tiktok"]) {
        const endpoint = base + "/api/marketplaces/" + platform;
        assert.equal((await anon.request.get(endpoint)).status(), 401);
        assert.equal(
            (await anon.request.post(endpoint + "/connect", { headers: origin })).status(),
            401,
        );
        assert.equal((await anon.request.delete(endpoint, { headers: origin })).status(), 401);
    }
    await publicPage.goto(base + "/");
    await publicPage.getByRole("heading", { name: /Your business deserves/ }).waitFor();
    assert.equal(await publicPage.getByText("Total revenue", { exact: true }).count(), 0);
    await publicPage.goto(base + "/notebook");
    assert.equal(new URL(publicPage.url()).pathname, "/auth/sign-in");
    await publicPage.goto(base + "/account");
    assert.equal(new URL(publicPage.url()).pathname, "/auth/sign-in");
    pass("Protected page redirects and all three private APIs reject anonymous requests");

    const email = `seller-notebook-e2e-${Date.now()}@example.com`;
    const password = crypto.randomBytes(24).toString("base64url");
    ownerContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    ownerContext.setDefaultTimeout(15000);
    ownerContext.setDefaultNavigationTimeout(20000);
    const owner = await ownerContext.newPage();
    owner.on("pageerror", (e) => errors.push(e.message));
    await owner.goto(base + "/auth/sign-up");
    await owner.getByLabel("Your name").fill("Neon E2E Owner");
    await owner.getByLabel("Email address").fill(email);
    await owner.getByLabel("Password", { exact: true }).fill(password);
    await owner.getByLabel("Confirm password", { exact: true }).fill("different-password");
    await owner.getByRole("button", { name: "Create account", exact: true }).click();
    await owner
        .getByText("Passwords do not match. Please enter the same password twice.", { exact: true })
        .waitFor();
    assert.equal(new URL(owner.url()).pathname, "/auth/sign-up");
    await owner.getByLabel("Confirm password", { exact: true }).fill(password);
    await owner.getByRole("button", { name: "Create account", exact: true }).click();
    await owner.waitForURL(base + "/notebook");
    const initial = await (await ownerContext.request.get(base + "/api/notebook")).json();
    users.push(initial.user.id);
    await owner.getByText("Live across your devices", { exact: true }).waitFor({ timeout: 30000 });
    pass("Neon Better Auth sign-up creates a real session");

    const second = await browser.newContext();
    const device = await second.newPage();
    await device.goto(base + "/auth/sign-in");
    await device.getByLabel("Email address").fill(email);
    await device.getByLabel("Password", { exact: true }).fill("Definitely-Wrong-Password-123!");
    await device.getByRole("button", { name: "Sign in", exact: true }).click();
    await device.locator(".auth-error").waitFor();
    assert.match(
        await device.locator(".auth-error").innerText(),
        /invalid|incorrect|password|credentials/i,
    );
    pass("Wrong password displays an authentication error");
    await signIn(device, email, password);
    await device.reload();
    await device.getByText("Live across your devices", { exact: true }).waitFor({ timeout: 30000 });
    assert.equal(
        (await (await second.request.get(base + "/api/notebook")).json()).user.id,
        initial.user.id,
    );
    await device
        .locator("#notebook-sidebar nav")
        .getByRole("button", { name: /^Inventory/ })
        .click();
    pass("Email/password sign-in and session restoration work in an independent browser");
    await owner
        .locator(".sidebar-theme")
        .getByRole("button", { name: "Switch to dark theme", exact: true })
        .click();
    await owner.reload();
    assert.equal(await owner.locator("html").getAttribute("data-theme"), "dark");
    if (process.env.NEON_E2E_SCREENSHOT_DIR) {
        fs.mkdirSync(process.env.NEON_E2E_SCREENSHOT_DIR, { recursive: true });
        await owner.screenshot({
            path: path.join(process.env.NEON_E2E_SCREENSHOT_DIR, "dark-overview.png"),
            fullPage: true,
        });
        await owner
            .getByRole("button", { name: "Open account and sync settings", exact: true })
            .click();
        await owner.getByRole("dialog").screenshot({
            path: path.join(process.env.NEON_E2E_SCREENSHOT_DIR, "dark-account.png"),
        });
        await owner.getByRole("button", { name: "Close account", exact: true }).click();
    }

    await owner
        .locator(".sidebar-theme")
        .getByRole("button", { name: "Switch to light theme", exact: true })
        .click();
    assert.equal(await owner.locator("html").getAttribute("data-theme"), "light");
    await owner.getByText("Live across your devices", { exact: true }).waitFor({ timeout: 30000 });
    pass("Light and dark paper themes switch correctly and persist after reload");
    const noteSaved = waitForSave(owner);
    await owner
        .getByLabel("A note to yourself", { exact: true })
        .fill("Pack carefully. One page at a time.");
    await noteSaved;
    await device.waitForFunction(
        () =>
            document.querySelector("#sidebar-personal-note")?.value ===
            "Pack carefully. One page at a time.",
    );
    await owner
        .getByRole("button", { name: "Open account and sync settings", exact: true })
        .click();
    await owner.getByRole("heading", { name: "Account settings", exact: true }).waitFor();
    await owner.getByRole("button", { name: "Close account", exact: true }).click();
    pass(
        "Personal sidebar note persists and syncs across devices; the full account row opens settings",
    );
    await owner
        .getByRole("button", { name: "Open account and sync settings", exact: true })
        .click();
    await owner.getByLabel("Display name", { exact: true }).fill("Updated Notebook Owner");
    await owner.getByRole("button", { name: "Save profile", exact: true }).click();
    await owner.getByText("Profile updated.", { exact: true }).waitFor();
    const png = await owner.evaluate(() => {
        const canvas = document.createElement("canvas");
        canvas.width = 32;
        canvas.height = 32;
        canvas.getContext("2d").fillRect(0, 0, 32, 32);
        return canvas.toDataURL("image/png").split(",")[1];
    });
    await owner.getByLabel("Change profile picture", { exact: true }).setInputFiles({
        name: "avatar.png",
        mimeType: "image/png",
        buffer: Buffer.from(png, "base64"),
    });
    await owner.getByRole("button", { name: "Remove picture", exact: true }).waitFor();
    await owner.waitForFunction(() => {
        const image = document.querySelector(".profile-picture-preview img");
        return image?.complete && image?.naturalWidth === 256;
    });
    assert.equal((await ownerContext.request.get(base + "/api/profile-picture")).status(), 200);
    assert.equal(
        (
            await ownerContext.request.get(base + "/api/profile-picture", {
                headers: { "X-Notebook-User": "someone-else" },
            })
        ).status(),
        401,
    );
    assert.equal(
        (
            await ownerContext.request.put(base + "/api/profile-picture", {
                headers: { Origin: "https://unrelated.example", "Content-Type": "image/webp" },
                data: "invalid",
            })
        ).status(),
        403,
    );
    await owner.reload();
    await owner.getByText("Live across your devices", { exact: true }).waitFor({ timeout: 30000 });
    await owner
        .getByRole("button", { name: "Open account and sync settings", exact: true })
        .click();
    await owner.getByRole("button", { name: "Remove picture", exact: true }).click();
    await owner
        .getByRole("button", { name: "Remove picture", exact: true })
        .waitFor({ state: "detached" });
    assert.equal((await ownerContext.request.get(base + "/api/profile-picture")).status(), 404);
    pass(
        "Profile picture uploads privately, displays at 256px, survives reload, and can be removed",
    );

    assert.equal(
        (await (await ownerContext.request.get(base + "/api/notebook")).json()).user.name,
        "Updated Notebook Owner",
    );
    await owner.reload();
    await owner.getByText("Live across your devices", { exact: true }).waitFor({ timeout: 30000 });
    await owner
        .getByRole("button", { name: "Open account and sync settings", exact: true })
        .click();
    assert.equal(
        await owner.getByLabel("Display name", { exact: true }).inputValue(),
        "Updated Notebook Owner",
    );
    pass("Profile display name updates through Neon Auth and survives reload");
    await owner.getByRole("tab", { name: "Branding", exact: true }).click();
    await owner.getByLabel("Business name", { exact: true }).fill("Little Shop");
    await owner.getByLabel("Notebook title", { exact: true }).fill("Little Shop Journal");
    await owner.getByLabel("Business tagline (optional)", { exact: true }).fill("Made with care");
    await owner.getByLabel("Notebook icon", { exact: true }).selectOption("store");
    const branded = waitForSave(owner);
    await owner.getByRole("button", { name: "Save branding", exact: true }).click();
    await branded;
    await owner.getByRole("button", { name: "Close account", exact: true }).click();
    await device
        .locator(".brand-title")
        .getByText("Little Shop Journal", { exact: true })
        .waitFor({ timeout: 30000 });
    await owner.reload();
    await owner.getByText("Live across your devices", { exact: true }).waitFor({ timeout: 30000 });
    assert.equal(await owner.locator(".brand-title").innerText(), "Little Shop Journal");
    assert.equal(await owner.title(), "Little Shop Journal — Little Shop");
    await device.waitForFunction(() => document.title === "Little Shop Journal — Little Shop");
    const identity = await owner.locator(".notebook-identity").boundingBox();
    const identityIcon = await owner.locator(".notebook-identity > svg").boundingBox();
    assert.ok(identityIcon.x - identity.x <= 14, "Sidebar identity icon must stay left aligned");
    await owner.setViewportSize({ width: 390, height: 844 });
    await owner.getByRole("button", { name: "Show sidebar", exact: true }).click();
    await owner.locator("#notebook-sidebar").evaluate(async (el) => {
        await new Promise(requestAnimationFrame);
        await Promise.all(
            el.getAnimations().map((animation) => animation.finished.catch(() => {})),
        );
    });
    const mobileIdentity = await owner.locator(".notebook-identity").boundingBox();
    const sidebar = await owner.locator("#notebook-sidebar").boundingBox();
    assert.ok(
        mobileIdentity.x >= sidebar.x &&
            mobileIdentity.x + mobileIdentity.width <= sidebar.x + sidebar.width,
    );
    await owner.getByRole("button", { name: "Hide sidebar", exact: true }).first().click();
    await owner.setViewportSize({ width: 1440, height: 1000 });

    assert.equal(
        (await (await ownerContext.request.get(base + "/api/notebook")).json()).document.branding
            .businessName,
        "Little Shop",
    );
    pass("Personal business branding saves, survives reload, and synchronizes to another browser");

    await owner
        .locator("#notebook-sidebar nav")
        .getByRole("button", { name: /^Inventory/ })
        .click();
    await owner.getByRole("button", { name: "Add product", exact: true }).click();
    await owner.getByLabel("Product name", { exact: true }).fill("Realtime test mug");
    await owner.getByLabel("SKU", { exact: true }).fill("E2E-MUG");
    await owner.getByLabel("Stock quantity").fill("10");
    await owner.getByLabel("Unit cost").fill("100");
    await owner.getByLabel("Selling price").fill("300");
    const saved = waitForSave(owner);
    await owner.getByRole("button", { name: "Save product", exact: true }).click();
    await saved;
    await device.getByText("Realtime test mug", { exact: true }).waitFor({ timeout: 30000 });
    assert.equal(
        (await (await second.request.get(base + "/api/notebook")).json()).document.products[0]
            .stock,
        10,
    );
    pass(
        "Postgres persists a product; Neon Realtime delivers it to another browser without reload",
    );
    await owner.locator(".inventory-card > summary").click();
    assert.equal(await owner.locator(".inventory-card").getAttribute("open"), null);
    assert.equal(
        await owner
            .locator(".inventory-card")
            .getByText("Realtime test mug", { exact: true })
            .isVisible(),
        false,
    );
    await owner.locator(".inventory-card > summary").click();
    await owner
        .locator(".inventory-card")
        .getByText("Realtime test mug", { exact: true })
        .waitFor();
    pass("Inventory section collapses to its heading and reopens without losing its contents");

    await owner
        .locator("#notebook-sidebar nav")
        .getByRole("button", { name: /^Pricing calculator/ })
        .click();
    await owner.getByLabel("Tax allowance (%)", { exact: true }).fill("5");
    await owner.locator(".price-result h2").getByText("₱290.00", { exact: true }).waitFor();
    assert.equal(
        await owner
            .locator(".price-line")
            .filter({ hasText: "Tax allowance" })
            .locator("strong")
            .innerText(),
        "₱14.50",
    );
    assert.equal(
        await owner
            .locator(".price-line")
            .filter({ hasText: "Estimated profit per item" })
            .locator("strong")
            .innerText(),
        "₱87.30",
    );
    await owner.getByLabel("Tax allowance (%)", { exact: true }).fill("70");
    await owner
        .getByText(
            "Enter non-negative values; fees, tax allowance, and margin must total less than 100%.",
            { exact: true },
        )
        .waitFor();
    await owner.getByLabel("Tax allowance (%)", { exact: true }).fill("0");
    pass(
        "Pricing calculator reserves configurable taxes, reconciles rounded-price costs/profit, and rejects impossible combined rates",
    );

    await owner
        .locator("#notebook-sidebar nav")
        .getByRole("button", { name: /^Suppliers/ })
        .click();
    await owner.getByRole("button", { name: "Add supplier", exact: true }).click();
    await owner.getByLabel("Supplier name", { exact: true }).fill("E2E Supply Studio");
    await owner.getByLabel("Contact person", { exact: true }).fill("Test contact");
    await owner.getByLabel("Supplier email", { exact: true }).fill("supply@example.com");
    await owner.getByLabel("Lead time (days)", { exact: true }).fill("7");
    await owner.locator(".supplier-products > summary").click();
    await owner.getByLabel(/Realtime test mug/).check();
    let supplierSaved = waitForSave(owner);
    await owner.getByRole("button", { name: "Save supplier", exact: true }).click();
    await supplierSaved;
    await device
        .locator("#notebook-sidebar nav")
        .getByRole("button", { name: /^Suppliers/ })
        .click();
    await device.getByText("E2E Supply Studio", { exact: true }).waitFor({ timeout: 30000 });
    assert.equal(
        (await (await second.request.get(base + "/api/notebook")).json()).document.suppliers[0]
            .productIds.length,
        1,
    );
    await owner
        .getByRole("button", { name: "Delete supplier E2E Supply Studio", exact: true })
        .click();
    await owner.getByRole("dialog", { name: "Please confirm", exact: true }).waitFor();
    await device
        .getByRole("button", { name: "Edit supplier E2E Supply Studio", exact: true })
        .click();
    await device
        .getByLabel("Contact person", { exact: true })
        .fill("Changed while confirmation open");
    const confirmationGuardSave = waitForSave(device);
    await device.getByRole("button", { name: "Save supplier", exact: true }).click();
    await confirmationGuardSave;
    await owner
        .getByText(
            "The notebook changed while this dialog was open. Cancel and review the latest details before trying again.",
            { exact: true },
        )
        .waitFor({ timeout: 30000 });
    assert.equal(
        await owner
            .getByRole("dialog", { name: "Please confirm", exact: true })
            .getByRole("button", { name: "Continue", exact: true })
            .isDisabled(),
        true,
    );
    await owner
        .getByRole("dialog", { name: "Please confirm", exact: true })
        .getByRole("button", { name: "Cancel", exact: true })
        .click();
    await owner
        .getByRole("dialog", { name: "Please confirm", exact: true })
        .waitFor({ state: "hidden" });
    await owner.getByText("E2E Supply Studio", { exact: true }).waitFor();
    pass("Styled confirmation blocks stale actions when another device changes the notebook");

    await owner
        .getByRole("button", { name: "Edit supplier E2E Supply Studio", exact: true })
        .click();
    console.log("CHECK editing saved supplier");
    await owner.getByLabel("Supplier notes", { exact: true }).fill("Saved supplier details");
    supplierSaved = waitForSave(owner);
    await owner.getByRole("button", { name: "Save supplier", exact: true }).click();
    await supplierSaved;
    const supplierDownload = owner.waitForEvent("download");
    await owner.getByRole("button", { name: "Export suppliers", exact: true }).click();
    assert.match(
        fs.readFileSync(await (await supplierDownload).path(), "utf8"),
        /E2E Supply Studio/,
    );
    let supplierSnapshot = await (await ownerContext.request.get(base + "/api/notebook")).json();
    const invalidSupplier = await ownerContext.request.put(base + "/api/notebook", {
        headers: origin,
        data: {
            revision: supplierSnapshot.revision,
            document: {
                ...supplierSnapshot.document,
                suppliers: [
                    { ...supplierSnapshot.document.suppliers[0], productIds: ["foreign-product"] },
                ],
            },
        },
    });
    assert.equal(invalidSupplier.status(), 400);
    const preservedSuppliers = supplierSnapshot.document.suppliers;
    const supplierLegacy = await ownerContext.request.put(base + "/api/notebook", {
        headers: origin,
        data: { revision: supplierSnapshot.revision, document: supplierSnapshot.document },
    });
    assert.equal(supplierLegacy.status(), 200);
    assert.deepEqual(
        (await (await ownerContext.request.get(base + "/api/notebook")).json()).document.suppliers,
        preservedSuppliers,
    );
    await owner.reload();
    await owner.getByText("Live across your devices", { exact: true }).waitFor({ timeout: 30000 });
    await owner
        .locator("#notebook-sidebar nav")
        .getByRole("button", { name: /^Suppliers/ })
        .click();
    await owner.getByText("E2E Supply Studio", { exact: true }).waitFor();
    await owner
        .getByRole("button", { name: "Edit supplier E2E Supply Studio", exact: true })
        .click();
    console.log("CHECK editing reloaded supplier");
    await owner.getByLabel("Supplier notes", { exact: true }).fill("Stale draft");
    await device
        .getByRole("button", { name: "Edit supplier E2E Supply Studio", exact: true })
        .click();
    await device.getByLabel("Contact person", { exact: true }).fill("Updated on another device");
    supplierSaved = waitForSave(device);
    await device.getByRole("button", { name: "Save supplier", exact: true }).click();
    await supplierSaved;
    await owner.getByText("Updated on another device", { exact: true }).waitFor({ timeout: 30000 });
    await owner.getByRole("button", { name: "Save supplier", exact: true }).click();
    await owner
        .getByText("This supplier changed on another device. Cancel and reopen the latest entry.", {
            exact: true,
        })
        .waitFor();
    await owner.getByRole("button", { name: "Cancel supplier edit", exact: true }).click();
    pass(
        "Supplier contacts and inventory links persist, synchronize, export, survive complete restores, and reject stale edits",
    );
    await owner.getByRole("button", { name: "Import suppliers CSV", exact: true }).click();
    const supplierCsv =
        "Supplier,Email,Lead time (days),Product SKUs\nE2E Supply Studio,ignored@example.com,2,E2E-MUG\nCSV Supply Studio,csv@example.com,4,E2E-MUG\n";
    await owner.getByLabel("Choose supplier CSV", { exact: true }).setInputFiles({
        name: "suppliers.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(supplierCsv),
    });
    await owner.getByText("1 new suppliers", { exact: true }).waitFor();
    await owner.getByText("1 existing suppliers skipped", { exact: true }).waitFor();
    assert.equal(
        await owner.getByRole("button", { name: "Add 1 suppliers", exact: true }).isDisabled(),
        true,
    );
    await owner
        .getByLabel("I’ve checked the supplier details and product links.", { exact: true })
        .check();
    const supplierImported = waitForSave(owner);
    await owner.getByRole("button", { name: "Add 1 suppliers", exact: true }).click();
    await supplierImported;
    await device.getByText("CSV Supply Studio", { exact: true }).waitFor({ timeout: 30000 });
    const afterSupplierImport = (
        await (await ownerContext.request.get(base + "/api/notebook")).json()
    ).document;
    assert.equal(afterSupplierImport.products[0].stock, 10);
    assert.equal(
        afterSupplierImport.suppliers.find((s) => s.name === "E2E Supply Studio").email,
        "supply@example.com",
    );
    await owner.getByLabel("Choose supplier CSV", { exact: true }).setInputFiles({
        name: "repeat.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(supplierCsv),
    });
    await owner.getByText("0 new suppliers", { exact: true }).waitFor();
    await owner.getByText("2 existing suppliers skipped", { exact: true }).waitFor();
    await owner.getByRole("button", { name: "Close supplier importer", exact: true }).click();
    await owner
        .locator("#notebook-sidebar nav")
        .getByRole("button", { name: /^Inventory/ })
        .click();
    await owner.locator(".restock-plan > summary").click();
    const importedSupplier = afterSupplierImport.suppliers.find(
        (s) => s.name === "CSV Supply Studio",
    );
    await owner.getByLabel("Restock supplier", { exact: true }).selectOption(importedSupplier.id);
    await owner
        .locator(".restock-plan tbody tr")
        .filter({ hasText: "Realtime test mug" })
        .locator("td:nth-child(2)>div")
        .filter({ hasText: /^CSV Supply Studio/ })
        .waitFor();
    await owner.locator(".restock-plan").getByText("4 day lead time", { exact: true }).waitFor();
    const filteredPlanDownload = owner.waitForEvent("download");
    await owner.getByRole("button", { name: "Export restock plan", exact: true }).click();
    const filteredPlanCsv = fs.readFileSync(await (await filteredPlanDownload).path(), "utf8");
    assert.match(filteredPlanCsv, /CSV Supply Studio/);
    await owner.getByRole("button", { name: "Prepare purchase order", exact: true }).click();
    const restockDialog = owner.getByRole("dialog", { name: "New purchase order", exact: true });
    await restockDialog.waitFor();
    assert.equal(
        await owner.getByLabel("Purchase supplier", { exact: true }).inputValue(),
        importedSupplier.id,
    );
    assert.equal(await owner.getByLabel("Purchase units 1", { exact: true }).inputValue(), "10");
    assert.equal(await owner.locator(".breadcrumb strong").innerText(), "Suppliers");
    await owner.getByRole("button", { name: "Cancel purchase entry", exact: true }).click();
    const afterDraft = (await (await ownerContext.request.get(base + "/api/notebook")).json())
        .document;
    assert.deepEqual(afterDraft.purchaseOrders, afterSupplierImport.purchaseOrders);
    assert.deepEqual(afterDraft.products, afterSupplierImport.products);
    await owner
        .locator("#notebook-sidebar nav")
        .getByRole("button", { name: /^Inventory/ })
        .click();
    await owner.locator(".restock-plan > summary").click();
    pass(
        "Restock planner opens an editable supplier purchase draft on the Suppliers tab; cancellation creates no purchase or stock change",
    );
    await owner.getByLabel("Restock supplier", { exact: true }).selectOption("unlinked");
    assert.equal(await owner.locator(".restock-plan tbody tr").count(), 0);
    await owner.getByLabel("Restock supplier", { exact: true }).selectOption("all");
    await owner.locator(".restock-plan > summary").click();
    await owner
        .locator("#notebook-sidebar nav")
        .getByRole("button", { name: /^Suppliers/ })
        .click();
    confirmationResponse = respondToConfirmation(owner, true);
    const importedSupplierDeleted = waitForSave(owner);
    await owner
        .getByRole("button", { name: "Delete supplier CSV Supply Studio", exact: true })
        .click();
    await confirmationResponse;
    await importedSupplierDeleted;
    pass(
        "Supplier CSV preview, duplicate skipping, product links, live saves, and supplier-filtered restock exports preserve stock",
    );

    await owner
        .locator("#notebook-sidebar nav")
        .getByRole("button", { name: /^Inventory/ })
        .click();
    await device
        .locator("#notebook-sidebar nav")
        .getByRole("button", { name: /^Inventory/ })
        .click();

    await owner.getByRole("button", { name: "Import inventory CSV", exact: true }).click();
    const inventoryCsv =
        "Product name,SKU,Unit cost,Selling price,Stock,Category,Currency\nExisting mug,E2E-MUG,1,1,999,Home,PHP\nCSV test bag,E2E-CSV,50,100,7,Bags,PHP\n";
    await owner.getByLabel("Choose inventory CSV", { exact: true }).setInputFiles({
        name: "inventory.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(inventoryCsv),
    });
    await owner.getByText("1 new products", { exact: true }).waitFor();
    await owner.getByText("1 existing SKUs skipped", { exact: true }).waitFor();
    await owner
        .getByLabel("I’ve checked product prices and current stock.", { exact: true })
        .check();
    const inventoryImported = waitForSave(owner);
    await owner.getByRole("button", { name: "Add 1 products", exact: true }).click();
    await inventoryImported;
    await device.getByText("CSV test bag", { exact: true }).waitFor({ timeout: 30000 });
    const importedProducts = (await (await ownerContext.request.get(base + "/api/notebook")).json())
        .document.products;
    assert.equal(importedProducts.find((product) => product.sku === "E2E-MUG").stock, 10);
    assert.equal(importedProducts.find((product) => product.sku === "E2E-CSV").stock, 7);
    await owner.getByLabel("Choose inventory CSV", { exact: true }).setInputFiles({
        name: "inventory.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(inventoryCsv),
    });
    await owner.getByText("2 existing SKUs skipped", { exact: true }).waitFor();
    assert.equal(
        await owner.getByRole("button", { name: "Add 0 products", exact: true }).isDisabled(),
        true,
    );
    await owner.getByRole("button", { name: "Close inventory importer", exact: true }).click();
    const inventoryExport = owner.waitForEvent("download");
    await owner.getByRole("button", { name: "Export", exact: true }).click();
    assert.equal((await inventoryExport).suggestedFilename(), "inventory-products.csv");
    pass(
        "Inventory CSV imports new products, preserves existing stock, skips repeats, synchronizes, and exports product data",
    );
    for (const [point, target] of [
        ["5", "15"],
        ["8", "20"],
    ]) {
        await owner
            .locator(".inventory-card")
            .getByRole("row")
            .filter({ hasText: "CSV test bag" })
            .getByRole("button", { name: "Edit", exact: true })
            .click();
        await owner.getByLabel("Low-stock alert level", { exact: true }).fill(point);
        await owner.getByLabel("Target stock level", { exact: true }).fill(target);
        const targetsSaved = waitForSave(owner);
        await owner.getByRole("button", { name: "Save product", exact: true }).click();
        await targetsSaved;
        await device
            .getByText(`Alert at ${point} · Target ${target}`, { exact: true })
            .waitFor({ timeout: 30000 });
        await owner.locator(".restock-plan > summary").click();
        if (point === "5")
            assert.equal(
                await owner
                    .locator(".restock-plan")
                    .getByRole("row")
                    .filter({ hasText: "CSV test bag" })
                    .count(),
                0,
            );
        else {
            await owner
                .locator(".restock-plan")
                .getByRole("row")
                .filter({ hasText: "CSV test bag" })
                .locator("td")
                .nth(5)
                .filter({ hasText: /^13$/ })
                .waitFor();
            const planExport = owner.waitForEvent("download");
            await owner.getByRole("button", { name: "Export restock plan", exact: true }).click();
            const planFile = await planExport;
            assert.equal(planFile.suggestedFilename(), "restock-plan.csv");
            assert.ok(fs.readFileSync(await planFile.path(), "utf8").includes("E2E-CSV"));
        }
        await owner.locator(".restock-plan > summary").click();
    }
    const plannedStock = (
        await (await ownerContext.request.get(base + "/api/notebook")).json()
    ).document.products.find((product) => product.sku === "E2E-CSV");
    assert.equal(plannedStock.stock, 7);
    assert.equal(plannedStock.reorderPoint, 8);
    assert.equal(plannedStock.targetStock, 20);
    pass(
        "Per-product alert/target levels save and sync, restock plans respect thresholds, and plan export leaves stock unchanged",
    );

    await owner.locator(".stock-adjustments > summary").click();
    for (const [kind, quantity, after, reason] of [
        ["Restock", "5", 12, "Weekly delivery"],
        ["Damage", "2", 10, "Damaged items"],
        ["Correction", "7", 7, "Physical stock count"],
    ]) {
        await owner
            .getByLabel("Adjustment product", { exact: true })
            .selectOption(importedProducts.find((product) => product.sku === "E2E-CSV").id);
        await owner.getByLabel("Adjustment type", { exact: true }).selectOption(kind);
        await owner
            .getByLabel(kind === "Correction" ? "Correct stock count" : "Units to adjust", {
                exact: true,
            })
            .fill(quantity);
        await owner.getByLabel("Reason for adjustment", { exact: true }).fill(reason);
        const adjusted = waitForSave(owner);
        await owner.getByRole("button", { name: "Record stock adjustment", exact: true }).click();
        await adjusted;
        await device
            .getByRole("row")
            .filter({ hasText: "CSV test bag" })
            .getByText(`${after} in stock`, { exact: true })
            .waitFor({ timeout: 30000 });
    }
    const stockSnapshot = (await (await ownerContext.request.get(base + "/api/notebook")).json())
        .document;
    assert.equal(stockSnapshot.stockAdjustments.length, 3);
    assert.equal(stockSnapshot.stockAdjustments[0].after, 7);
    assert.equal(stockSnapshot.products.find((product) => product.sku === "E2E-MUG").stock, 10);
    const historyExport = owner.waitForEvent("download");
    await owner.getByRole("button", { name: "Export stock history", exact: true }).click();
    assert.equal((await historyExport).suggestedFilename(), "stock-adjustment-history.csv");
    await owner.locator(".stock-adjustments > summary").click();
    pass(
        "Manual restocks, damage, corrections, and stock history persist and synchronize without changing other products",
    );

    const inventoryPadding = await owner.locator("main").evaluate((el) => ({
        left: getComputedStyle(el).paddingLeft,
        right: getComputedStyle(el).paddingRight,
        x: el.getBoundingClientRect().x,
        width: el.getBoundingClientRect().width,
    }));
    await owner
        .locator("#notebook-sidebar nav")
        .getByRole("button", { name: /^Overview/ })
        .click();
    const overviewPadding = await owner.locator("main").evaluate((el) => ({
        left: getComputedStyle(el).paddingLeft,
        right: getComputedStyle(el).paddingRight,
        x: el.getBoundingClientRect().x,
        width: el.getBoundingClientRect().width,
    }));
    assert.deepEqual(inventoryPadding, overviewPadding);
    assert.equal(
        await owner
            .locator(".topbar .theme-switch,.topbar .account-button,.topbar .top-avatar")
            .count(),
        0,
    );
    pass(
        "Inventory and Overview share the same page width and padding; duplicate header controls are removed",
    );

    await owner
        .locator("#notebook-sidebar nav")
        .getByRole("button", { name: /^Orders/ })
        .click();
    await owner.getByRole("button", { name: "Record a sale", exact: true }).click();
    await owner.getByLabel("Customer name").fill("E2E customer");
    const orderSaved = waitForSave(owner);
    await owner.getByRole("button", { name: "Record sale", exact: true }).click();
    await orderSaved;
    const completeSaved = waitForSave(owner);
    await owner
        .getByRole("row")
        .filter({ hasText: "E2E customer" })
        .getByRole("button", { name: "Complete", exact: true })
        .click();
    await completeSaved;
    await device.getByText("9 in stock", { exact: true }).waitFor({ timeout: 30000 });
    const final = await (await second.request.get(base + "/api/notebook")).json();
    assert.equal(final.document.orders[0].status, "Completed");
    assert.equal(final.document.products[0].stock, 9);
    pass("Completed order and stock changes persist and synchronize live");
    await owner
        .locator("#notebook-sidebar nav")
        .getByRole("button", { name: /^Overview/ })
        .click();
    await owner.getByLabel("Date range", { exact: true }).selectOption("custom");
    const saleDay = final.document.orders[0].date,
        dayBeforeSale = new Date(Date.parse(saleDay + "T12:00:00Z") - 86400000)
            .toISOString()
            .slice(0, 10);
    await owner.getByLabel("Report from", { exact: true }).fill(dayBeforeSale);
    await owner.getByLabel("Report through", { exact: true }).fill(dayBeforeSale);
    assert.equal(
        await owner
            .locator(".stat")
            .filter({ hasText: "Total revenue" })
            .locator(".stat-value")
            .innerText(),
        "₱0.00",
    );
    await owner.getByLabel("Report through", { exact: true }).fill(saleDay);
    await owner.getByLabel("Report from", { exact: true }).fill(saleDay);
    assert.equal(
        await owner
            .locator(".stat")
            .filter({ hasText: "Total revenue" })
            .locator(".stat-value")
            .innerText(),
        "₱300.00",
    );
    const summaryDownload = owner.waitForEvent("download");
    await owner.getByRole("button", { name: "Export summary", exact: true }).click();
    assert.equal(
        (await summaryDownload).suggestedFilename(),
        `business-summary-${saleDay}-${saleDay}.csv`,
    );
    await owner.getByLabel("Date range", { exact: true }).selectOption("all");
    assert.equal(
        await owner
            .locator(".stat")
            .filter({ hasText: "Total revenue" })
            .locator(".stat-value")
            .innerText(),
        "₱300.00",
    );
    await owner.getByLabel("Date range", { exact: true }).selectOption("30");
    pass(
        "Custom reporting dates, all-time totals, and period-summary CSV export work in the browser",
    );

    await owner
        .locator("#notebook-sidebar nav")
        .getByRole("button", { name: /^Inventory/ })
        .click();
    await owner
        .locator("#notebook-sidebar nav")
        .getByRole("button", { name: /^Orders/ })
        .click();
    const connectionStatus = await (await ownerContext.request.get(base + "/api/shopee")).json();
    assert.equal(connectionStatus.connected, false);
    if (!connectionStatus.configured) {
        assert.equal(await owner.locator(".marketplace-drawer").getAttribute("open"), null);
        await owner.locator(".marketplace-drawer > summary").click();
        await owner
            .locator("section")
            .filter({ has: owner.getByRole("heading", { name: "Shopee", exact: true }) })
            .getByText("Coming soon · Connection is being worked on", { exact: true })
            .waitFor();
        assert.equal(
            await owner
                .getByRole("button", { name: "Connect Shopee shop", exact: true })
                .isDisabled(),
            true,
        );
        for (const platform of ["Lazada", "TikTok Shop"])
            assert.equal(
                await owner
                    .getByRole("button", { name: `Connect ${platform} shop`, exact: true })
                    .isDisabled(),
                true,
            );
        assert.equal(
            (
                await ownerContext.request.post(base + "/api/shopee/connect", { headers: origin })
            ).status(),
            503,
        );
    }
    const badOrigin = await ownerContext.request.post(base + "/api/shopee/connect", {
        headers: { Origin: "https://unrelated.example" },
    });
    assert.equal(badOrigin.status(), 403);
    const { neon: fixtureSql } = require("@neondatabase/serverless");
    const fixtureDb = fixtureSql(process.env.DATABASE_URL);
    const { sealTokens } = await import("../lib/shopee-api.mjs");
    const fixtureConnection = crypto.randomUUID();
    const fixtureCipher = sealTokens(
        {
            accessToken: "fixture-access",
            refreshToken: "fixture-refresh",
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
        Buffer.alloc(32, 9),
        initial.user.id,
        "999999999",
    );
    await fixtureDb`INSERT INTO seller_shopee_connections (owner_id,connection_id,shop_id,environment,token_ciphertext,expires_at) VALUES (${initial.user.id},${fixtureConnection},'999999999','sandbox',${fixtureCipher},${new Date(Date.now() + 3600000).toISOString()})`;
    const ownConnection = await (await ownerContext.request.get(base + "/api/shopee")).json();
    assert.equal(ownConnection.shop.shopId, "999999999");
    assert.ok(!JSON.stringify(ownConnection).includes(fixtureCipher));
    pass(
        "Shopee setup status, anonymous guards, cross-origin protection, and token-free metadata pass",
    );
    for (const platform of ["lazada", "tiktok"]) {
        const endpoint = base + "/api/marketplaces/" + platform;
        const response = await ownerContext.request.get(endpoint);
        assert.equal(response.status(), 200);
        const status = await response.json();
        assert.equal(status.connected, false);
        assert.equal(status.orderImportAvailable, false);
        if (!status.configured) {
            assert.equal(
                (
                    await ownerContext.request.post(endpoint + "/connect", { headers: origin })
                ).status(),
                503,
            );
            assert.equal(
                (
                    await ownerContext.request.get(
                        endpoint + "/callback?state=invalid&code=invalid",
                    )
                ).status(),
                503,
            );
        }
        assert.equal(
            (
                await ownerContext.request.post(endpoint + "/connect", {
                    headers: { Origin: "https://unrelated.example" },
                })
            ).status(),
            403,
        );
        assert.equal(
            (
                await ownerContext.request.delete(endpoint, {
                    headers: { Origin: "https://unrelated.example" },
                })
            ).status(),
            403,
        );
        await fixtureDb`INSERT INTO seller_marketplace_connections (owner_id,platform,connection_id,account_id,token_ciphertext,app_fingerprint,expires_at) VALUES (${initial.user.id},${platform},${crypto.randomUUID()},'fixture-seller','private-fixture-token','fixture-app',${new Date(Date.now() + 3600000).toISOString()})`;
        const metadata = await (await ownerContext.request.get(endpoint)).json();
        assert.equal(metadata.connected, true);
        assert.equal(metadata.account.id, "fixture-seller");
        assert.equal(metadata.needsReconnect, true);
        assert.ok(!JSON.stringify(metadata).includes("private-fixture-token"));
        assert.ok(!JSON.stringify(metadata).includes("fixture-app"));
    }
    assert.equal(
        (await ownerContext.request.get(base + "/api/marketplaces/unknown")).status(),
        404,
    );
    pass(
        "Lazada and TikTok configuration gating, callback guards, origin checks, and token-free metadata pass",
    );

    await owner.getByRole("button", { name: "Import orders CSV", exact: true }).click();
    const importCsv =
        "Order ID,Seller SKU,Quantity,Unit Price,Order Date,Order Status,Buyer Username,Currency\nSHP-E2E-1,E2E-MUG,2,300,2026-11-05,Processing,Import customer,PHP\n";
    await owner.getByLabel("Choose Shopee CSV", { exact: true }).setInputFiles({
        name: "shopee-e2e.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(importCsv),
    });
    await owner.getByText("1 new lines", { exact: true }).waitFor();
    await owner
        .getByLabel("I’ve reviewed the prices and cost defaults. Keep current stock unchanged.")
        .check();
    const imported = waitForSave(owner);
    await owner.getByRole("button", { name: "Add 1 order lines", exact: true }).click();
    await imported;
    const importRow = owner.getByRole("row").filter({ hasText: "Import customer" });
    const cancelled = waitForSave(owner);
    await importRow.getByRole("button", { name: "Cancel", exact: true }).click();
    await cancelled;
    const importedState = await (await ownerContext.request.get(base + "/api/notebook")).json();
    assert.equal(importedState.document.products[0].stock, 9);
    assert.equal(
        importedState.document.orders.filter((o) => o.sourceOrderId === "SHP-E2E-1").length,
        1,
    );
    await owner.getByLabel("Choose Shopee CSV", { exact: true }).setInputFiles({
        name: "shopee-e2e.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(importCsv),
    });
    await owner.getByText("1 already imported", { exact: true }).waitFor();
    assert.equal(
        await owner.getByRole("button", { name: "Add 0 order lines", exact: true }).isDisabled(),
        true,
    );
    pass(
        "Shopee CSV preview, Postgres persistence, duplicate skipping, and historical-stock cancellation pass",
    );
    for (const platform of ["Lazada", "TikTok Shop"]) {
        await owner.getByLabel("Marketplace for CSV", { exact: true }).selectOption(platform);
        const csv = importCsv.replace("Import customer", platform + " import customer");
        await owner.getByLabel(`Choose ${platform} CSV`, { exact: true }).setInputFiles({
            name: "marketplace.csv",
            mimeType: "text/csv",
            buffer: Buffer.from(csv),
        });
        await owner.getByText("1 new lines", { exact: true }).waitFor();
        await owner
            .getByLabel("I’ve reviewed the prices and cost defaults. Keep current stock unchanged.")
            .check();
        const added = waitForSave(owner);
        await owner.getByRole("button", { name: "Add 1 order lines", exact: true }).click();
        await added;
        const row = owner.getByRole("row").filter({ hasText: platform + " import customer" });
        const cancelled = waitForSave(owner);
        await row.getByRole("button", { name: "Cancel", exact: true }).click();
        await cancelled;
        const snapshot = await (await ownerContext.request.get(base + "/api/notebook")).json();
        assert.equal(snapshot.document.products[0].stock, 9);
        assert.equal(
            snapshot.document.orders.filter(
                (o) => o.sourceOrderId === "SHP-E2E-1" && o.channel === platform,
            ).length,
            1,
        );
        await owner.getByLabel(`Choose ${platform} CSV`, { exact: true }).setInputFiles({
            name: "marketplace.csv",
            mimeType: "text/csv",
            buffer: Buffer.from(csv),
        });
        await owner.getByText("1 already imported", { exact: true }).waitFor();
    }
    if (process.env.NEON_E2E_SCREENSHOT_DIR) {
        fs.mkdirSync(process.env.NEON_E2E_SCREENSHOT_DIR, { recursive: true });
        await owner.locator(".marketplace-drawer").screenshot({
            path: path.join(process.env.NEON_E2E_SCREENSHOT_DIR, "marketplace-connections.png"),
        });
        await owner.locator(".import-card").screenshot({
            path: path.join(process.env.NEON_E2E_SCREENSHOT_DIR, "marketplace-import.png"),
        });
        const selector = await owner
            .getByLabel("Marketplace for CSV", { exact: true })
            .boundingBox();
        const upload = await owner.locator(".upload-button").boundingBox();
        const template = await owner
            .getByRole("button", { name: "Example template", exact: true })
            .boundingBox();
        assert.ok(Math.abs(selector.y + selector.height - upload.y - upload.height) < 2);
        assert.ok(Math.abs(selector.y + selector.height - template.y - template.height) < 2);
        await owner
            .locator(".sidebar-theme")
            .getByRole("button", { name: "Switch to dark theme", exact: true })
            .click();
        await owner.locator(".import-card").screenshot({
            path: path.join(process.env.NEON_E2E_SCREENSHOT_DIR, "dark-import.png"),
        });
        await owner.screenshot({
            path: path.join(process.env.NEON_E2E_SCREENSHOT_DIR, "dark-notebook.png"),
        });
        await owner.setViewportSize({ width: 390, height: 844 });
        assert.equal(
            await owner.evaluate(() => document.documentElement.scrollWidth > innerWidth),
            false,
        );
        await owner.screenshot({
            path: path.join(process.env.NEON_E2E_SCREENSHOT_DIR, "dark-mobile.png"),
        });
        await owner.setViewportSize({ width: 1440, height: 1000 });
        await owner
            .locator(".sidebar-theme")
            .getByRole("button", { name: "Switch to light theme", exact: true })
            .click();
    }
    pass(
        "Lazada and TikTok CSV imports persist independently, skip duplicates, and preserve current stock on cancellation",
    );
    await owner.getByLabel("Search orders", { exact: true }).fill("E2E-MUG");
    await owner.getByText("E2E customer", { exact: true }).waitFor();
    await owner.getByLabel("Search orders", { exact: true }).fill("SHP-E2E-1");
    await owner.getByRole("row").filter({ hasText: "Import customer" }).first().waitFor();
    await owner.getByLabel("Search orders", { exact: true }).fill("");
    for (const name of ["Bulk manual 1", "Bulk manual 2"]) {
        await owner.getByRole("button", { name: "Record a sale", exact: true }).click();
        await owner.getByLabel("Customer name", { exact: true }).fill(name);
        const recorded = waitForSave(owner);
        await owner.getByRole("button", { name: "Record sale", exact: true }).click();
        await recorded;
    }
    await owner.getByLabel("Search orders", { exact: true }).fill("Bulk manual");
    await owner.getByLabel("Order status filter", { exact: true }).selectOption("Processing");
    await owner.getByLabel("Select all visible processing orders", { exact: true }).check();
    confirmationResponse = respondToConfirmation(owner, true);
    let bulkSaved = waitForSave(owner);
    await owner.getByRole("button", { name: "Cancel selected", exact: true }).click();
    await confirmationResponse;
    await bulkSaved;
    let bulkState = await (await ownerContext.request.get(base + "/api/notebook")).json();
    assert.equal(bulkState.document.products.find((product) => product.sku === "E2E-MUG").stock, 9);
    assert.equal(
        bulkState.document.orders.filter(
            (order) => order.customer.startsWith("Bulk manual") && order.status === "Cancelled",
        ).length,
        2,
    );
    await owner.getByLabel("Order status filter", { exact: true }).selectOption("Cancelled");
    const filteredExport = owner.waitForEvent("download");
    await owner.getByRole("button", { name: "Export", exact: true }).click();
    const filteredCsv = fs.readFileSync(await (await filteredExport).path(), "utf8");
    assert.ok(filteredCsv.includes("Bulk manual 1"));
    assert.ok(!filteredCsv.includes("E2E customer"));
    await owner.getByLabel("Search orders", { exact: true }).fill("Bulk history");
    await owner.getByLabel("Order status filter", { exact: true }).selectOption("Processing");
    const historyCsv =
        "Order ID,Seller SKU,Quantity,Unit Price,Order Date,Order Status,Buyer Username,Currency\nBULK-HISTORY-1,E2E-MUG,1,300,2026-11-05,Processing,Bulk history 1,PHP\nBULK-HISTORY-2,E2E-MUG,1,300,2026-11-05,Processing,Bulk history 2,PHP\n";
    await owner.getByLabel("Choose TikTok Shop CSV", { exact: true }).setInputFiles({
        name: "bulk-history.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(historyCsv),
    });
    await owner.getByText("2 new lines", { exact: true }).waitFor();
    await owner
        .getByLabel("I’ve reviewed the prices and cost defaults. Keep current stock unchanged.")
        .check();
    const historySaved = waitForSave(owner);
    await owner.getByRole("button", { name: "Add 2 order lines", exact: true }).click();
    await historySaved;
    await owner.getByLabel("Select all visible processing orders", { exact: true }).check();
    confirmationResponse = respondToConfirmation(owner, true);
    bulkSaved = waitForSave(owner);
    await owner.getByRole("button", { name: "Complete selected", exact: true }).click();
    await confirmationResponse;
    await bulkSaved;
    bulkState = await (await ownerContext.request.get(base + "/api/notebook")).json();
    assert.equal(bulkState.document.products.find((product) => product.sku === "E2E-MUG").stock, 9);
    assert.equal(
        bulkState.document.orders.filter(
            (order) => order.customer.startsWith("Bulk history") && order.status === "Completed",
        ).length,
        2,
    );
    await owner.getByLabel("Search orders", { exact: true }).fill("");
    await owner.getByLabel("Order status filter", { exact: true }).selectOption("All statuses");
    pass(
        "Order SKU/source-ID search, status filters, filtered CSV export, bulk cancellation, and bulk completion pass with correct stock",
    );
    await owner
        .getByRole("row")
        .filter({ hasText: "Bulk history 1" })
        .getByRole("button", { name: /^Details for/ })
        .click();
    const orderDialog = owner.getByRole("dialog", { name: "Order details", exact: true });
    await orderDialog.getByRole("heading", { name: "Little Shop", exact: true }).waitFor();
    await orderDialog.locator(".order-private-details:not(.order-refunds) > summary").click();
    await orderDialog.getByText("Platform fees", { exact: true }).waitFor();
    const customerDownload = owner.waitForEvent("download");
    await orderDialog.getByRole("button", { name: "Download customer copy", exact: true }).click();
    const customerFile = await customerDownload;
    assert.ok(customerFile.suggestedFilename().endsWith(".html"));
    const customerHtml = fs.readFileSync(await customerFile.path(), "utf8");
    assert.ok(customerHtml.includes("Little Shop"));
    assert.ok(customerHtml.includes("Bulk history 1"));
    assert.ok(!customerHtml.includes("Estimated order profit"));
    assert.ok(!customerHtml.includes("Platform fees"));
    const printWindow = owner.waitForEvent("popup");
    await orderDialog.getByRole("button", { name: "Print customer copy", exact: true }).click();
    const copyPage = await printWindow;
    await copyPage.getByRole("heading", { name: "Order summary", exact: true }).waitFor();
    assert.equal(await copyPage.evaluate(() => window.opener), null);
    assert.ok(!(await copyPage.locator("body").innerText()).includes("Platform fees"));
    await copyPage.close();
    await orderDialog.locator(".order-refunds > summary").click();
    const refundedOrder = bulkState.document.orders.find(
        (order) => order.customer === "Bulk history 1",
    );
    await owner.getByLabel("Refund order line", { exact: true }).selectOption(refundedOrder.id);
    for (const [amount, reason] of [
        ["50", "Private partial refund reason"],
        ["250", "Remaining refund"],
    ]) {
        await owner.getByLabel("Refund amount (PHP)", { exact: true }).fill(amount);
        await owner.getByLabel("Refund reason", { exact: true }).fill(reason);
        const refunded = waitForSave(owner);
        await owner.getByRole("button", { name: "Record issued refund", exact: true }).click();
        await refunded;
    }
    assert.equal(
        await owner.getByRole("button", { name: "Record issued refund", exact: true }).isDisabled(),
        true,
    );
    let refundedSnapshot = await (await ownerContext.request.get(base + "/api/notebook")).json();
    assert.equal(
        refundedSnapshot.document.products.find((product) => product.sku === "E2E-MUG").stock,
        9,
    );
    assert.equal(
        refundedSnapshot.document.refundRecords.reduce((sum, record) => sum + record.amount, 0),
        300,
    );
    const excessive = await ownerContext.request.put(base + "/api/notebook", {
        headers: origin,
        data: {
            revision: refundedSnapshot.revision,
            document: {
                ...refundedSnapshot.document,
                refundRecords: [
                    ...refundedSnapshot.document.refundRecords,
                    {
                        id: crypto.randomUUID(),
                        orderId: refundedOrder.id,
                        amount: 0.01,
                        date: "2026-11-05",
                        reason: "Excess",
                    },
                ],
            },
        },
    });
    assert.equal(excessive.status(), 400);
    confirmationResponse = respondToConfirmation(owner, true);
    const refundRemoved = waitForSave(owner);
    await owner
        .locator(".refund-record")
        .filter({ hasText: "Remaining refund" })
        .getByRole("button", { name: "Remove record", exact: true })
        .click();
    await confirmationResponse;
    await refundRemoved;
    refundedSnapshot = await (await ownerContext.request.get(base + "/api/notebook")).json();
    assert.equal(refundedSnapshot.document.refundRecords.length, 1);
    const refundDownload = owner.waitForEvent("download");
    await orderDialog.getByRole("button", { name: "Download customer copy", exact: true }).click();
    const refundHtml = fs.readFileSync(await (await refundDownload).path(), "utf8");
    assert.ok(refundHtml.includes("Recorded refunds:"));
    assert.ok(!refundHtml.includes("Private partial refund reason"));
    await device
        .locator("#notebook-sidebar nav")
        .getByRole("button", { name: /^Overview/ })
        .click();
    const { profitSummary: refundProfit } = await import("../lib/expenses.mjs");
    const refundedProfit = refundProfit(
        refundedSnapshot.document.orders,
        refundedSnapshot.document.expenses,
        refundedSnapshot.document.refundRecords,
    ).netProfit;
    await device
        .locator(".stat")
        .filter({ hasText: "Estimated net profit" })
        .getByText(
            new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
                refundedProfit,
            ),
            { exact: true },
        )
        .waitFor({ timeout: 30000 });
    await owner.getByRole("button", { name: "Close order details", exact: true }).click();
    pass(
        "Partial/full refunds save and sync, cap at item value, preserve stock, adjust profit, and keep private reasons out of customer copies",
    );
    pass(
        "Branded order details, private estimates, customer-copy download, and print window work without exposing internal costs",
    );

    await owner
        .locator("#notebook-sidebar nav")
        .getByRole("button", { name: /^Expenses/ })
        .click();
    await device
        .locator("#notebook-sidebar nav")
        .getByRole("button", { name: /^Expenses/ })
        .click();
    await owner.getByRole("button", { name: "New expense", exact: true }).click();
    await owner.getByLabel("Expense title", { exact: true }).fill("E2E ad cost");
    assert.equal(await owner.getByRole("dialog", { name: "New expense", exact: true }).count(), 1);
    assert.equal(await owner.locator(".shell").evaluate((el) => el.inert), true);

    await owner.getByLabel("Amount (₱)", { exact: true }).fill("12.34");
    const expenseSaved = waitForSave(owner);
    await owner.getByRole("button", { name: "Add expense", exact: true }).click();
    await expenseSaved;
    await device.getByRole("row").filter({ hasText: "E2E ad cost" }).waitFor({ timeout: 30000 });
    await owner.getByRole("button", { name: "Edit E2E ad cost", exact: true }).click();
    await owner.getByLabel("Amount (₱)", { exact: true }).fill("20.45");
    const expenseEdited = waitForSave(owner);
    await owner.getByRole("button", { name: "Save expense", exact: true }).click();
    await expenseEdited;
    await device
        .getByRole("row")
        .filter({ hasText: "E2E ad cost" })
        .getByText("₱20.45", { exact: true })
        .waitFor({ timeout: 30000 });
    await device.getByRole("button", { name: "Edit E2E ad cost", exact: true }).click();
    await owner.getByRole("button", { name: "Edit E2E ad cost", exact: true }).click();
    await owner.getByLabel("Amount (₱)", { exact: true }).fill("30.55");
    const newerExpense = waitForSave(owner);
    await owner.getByRole("button", { name: "Save expense", exact: true }).click();
    await newerExpense;
    await device
        .locator(".expense-list tbody tr")
        .filter({ hasText: "E2E ad cost" })
        .getByText("₱30.55", { exact: true })
        .waitFor({ timeout: 30000 });
    await device.getByLabel("Amount (₱)", { exact: true }).fill("21.45");
    await device.getByRole("button", { name: "Save expense", exact: true }).click();
    await device
        .getByText(
            "This expense changed or was removed on another device. Cancel this edit and reopen the latest entry.",
            { exact: true },
        )
        .waitFor();
    await device.getByRole("button", { name: "Cancel edit", exact: true }).click();
    pass("An open expense edit cannot overwrite a newer change from another device");
    const beforeLegacy = await (await ownerContext.request.get(base + "/api/notebook")).json();
    const legacyRefreshed = owner.waitForResponse(
        (response) => {
            const url = new URL(response.url());
            return (
                url.pathname === "/api/notebook/expenses" &&
                Number(url.searchParams.get("revision")) > beforeLegacy.revision &&
                response.status() === 200
            );
        },
        { timeout: 30000 },
    );
    const legacy = await ownerContext.request.put(base + "/api/notebook", {
        headers: origin,
        data: { revision: beforeLegacy.revision, document: beforeLegacy.document },
    });
    assert.equal(legacy.status(), 200);
    await legacyRefreshed;
    const preserved = await (await ownerContext.request.get(base + "/api/notebook")).json();
    assert.equal(preserved.document.expenses[0].amount, 30.55);
    assert.equal(preserved.document.sidebarNote, "Pack carefully. One page at a time.");
    assert.equal(preserved.document.branding.businessName, "Little Shop");
    assert.equal(preserved.document.stockAdjustments.length, 3);
    assert.equal(preserved.document.refundRecords.length, 1);
    const { profitSummary } = await import("../lib/expenses.mjs");
    const net = profitSummary(
        preserved.document.orders,
        preserved.document.expenses,
        preserved.document.refundRecords,
    ).netProfit;
    await owner
        .locator(".stat")
        .filter({ hasText: "Estimated net profit" })
        .getByText(
            new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(net),
            { exact: true },
        )
        .waitFor();
    await owner.getByLabel("Filter channel", { exact: true }).selectOption("Shopee");
    assert.equal(await owner.getByRole("row").filter({ hasText: "E2E ad cost" }).count(), 0);
    await owner.getByLabel("Filter channel", { exact: true }).selectOption("All channels");
    await owner.getByRole("row").filter({ hasText: "E2E ad cost" }).waitFor();
    const downloadEvent = owner.waitForEvent("download");
    await owner.getByRole("button", { name: "Export expenses", exact: true }).click();
    const expenseDownload = await downloadEvent;
    assert.equal(expenseDownload.suggestedFilename(), "sellers-notebook-expenses.csv");
    if (process.env.NEON_E2E_SCREENSHOT_DIR) {
        fs.mkdirSync(process.env.NEON_E2E_SCREENSHOT_DIR, { recursive: true });
        await owner.screenshot({
            path: path.join(process.env.NEON_E2E_SCREENSHOT_DIR, "expenses-desktop.png"),
            fullPage: true,
        });
        await device.setViewportSize({ width: 390, height: 844 });
        await device.waitForTimeout(250);
        assert.equal(
            await device.evaluate(() => document.documentElement.scrollWidth > innerWidth),
            false,
        );
        await device.screenshot({
            path: path.join(process.env.NEON_E2E_SCREENSHOT_DIR, "expenses-mobile.png"),
            fullPage: true,
        });
        await device.setViewportSize({ width: 1280, height: 900 });
        await device.waitForTimeout(250);
    }
    pass(
        "Expense add/edit, cross-device updates, channel filtering, net profit, CSV export, and complete-restore preservation pass",
    );

    await owner
        .locator("#notebook-sidebar nav")
        .getByRole("button", { name: /^Inventory/ })
        .click();
    const linkedMug = preserved.document.products.find((product) => product.sku === "E2E-MUG").id;
    const linkedBag = preserved.document.products.find((product) => product.sku === "E2E-CSV").id;
    await owner.locator("#product-attachments > summary").click();
    await owner.getByRole("button", { name: "Files for Realtime test mug", exact: true }).click();
    assert.equal(
        await owner.getByLabel("Files for inventory item", { exact: true }).inputValue(),
        linkedMug,
    );
    const receipt = Buffer.from("Seller Notebook Neon attachment end-to-end verification.");
    const uploaded = owner.waitForResponse(
        (r) => r.url().endsWith("/api/attachments") && r.request().method() === "POST",
        { timeout: 20000 },
    );
    await owner.getByLabel("Attach a file", { exact: true }).setInputFiles({
        name: "verification-receipt.txt",
        mimeType: "text/plain",
        buffer: receipt,
    });
    const uploadResponse = await uploaded;
    console.log("CHECK attachment upload response received");
    assert.equal(uploadResponse.status(), 201);
    const uploadedFiles = await (await ownerContext.request.get(base + "/api/attachments")).json();
    attachmentId = uploadedFiles.attachments.find(
        (file) => file.filename === "verification-receipt.txt",
    )?.id;
    assert.ok(attachmentId);
    console.log("CHECK waiting for attachment listing");
    await owner.getByRole("link", { name: "verification-receipt.txt" }).waitFor();
    console.log("CHECK downloading stored attachment");
    const downloaded = await ownerContext.request.get(base + "/api/attachments/" + attachmentId, {
        timeout: 15000,
    });
    assert.equal(downloaded.status(), 200);
    assert.deepEqual(await downloaded.body(), receipt);
    pass("Neon private Object Storage upload, metadata listing, and byte-for-byte download work");
    assert.equal(
        uploadedFiles.attachments.find((file) => file.id === attachmentId).productId,
        linkedMug,
    );
    assert.equal(
        (
            await (
                await ownerContext.request.get(base + "/api/attachments?productId=" + linkedMug)
            ).json()
        ).attachments.length,
        1,
    );
    assert.equal(
        (
            await (
                await ownerContext.request.get(base + "/api/attachments?productId=" + linkedBag)
            ).json()
        ).attachments.length,
        0,
    );
    let relink = owner.waitForResponse(
        (r) =>
            r.url().endsWith("/api/attachments/" + attachmentId) &&
            r.request().method() === "PATCH",
    );
    await owner
        .getByLabel("Linked product for verification-receipt.txt", { exact: true })
        .selectOption(linkedBag);
    assert.equal((await relink).status(), 200);
    await owner
        .getByRole("link", { name: "verification-receipt.txt", exact: true })
        .waitFor({ state: "detached" });
    assert.equal(
        (
            await (
                await ownerContext.request.get(base + "/api/attachments?productId=" + linkedBag)
            ).json()
        ).attachments.length,
        1,
    );
    await owner.getByLabel("Files for inventory item", { exact: true }).selectOption("");
    relink = owner.waitForResponse(
        (r) =>
            r.url().endsWith("/api/attachments/" + attachmentId) &&
            r.request().method() === "PATCH",
    );
    await owner
        .getByLabel("Linked product for verification-receipt.txt", { exact: true })
        .selectOption("");
    assert.equal((await relink).status(), 200);
    assert.equal(
        (await (await ownerContext.request.get(base + "/api/attachments?unlinked=1")).json())
            .attachments.length,
        1,
    );
    relink = owner.waitForResponse(
        (r) =>
            r.url().endsWith("/api/attachments/" + attachmentId) &&
            r.request().method() === "PATCH",
    );
    await owner
        .getByLabel("Linked product for verification-receipt.txt", { exact: true })
        .selectOption(linkedMug);
    assert.equal((await relink).status(), 200);
    assert.equal(
        (
            await ownerContext.request.patch(base + "/api/attachments/" + attachmentId, {
                headers: origin,
                data: { productId: "unknown-product" },
            })
        ).status(),
        400,
    );
    assert.equal(
        (
            await ownerContext.request.patch(base + "/api/attachments/" + attachmentId, {
                headers: { Origin: "https://unrelated.example" },
                data: { productId: null },
            })
        ).status(),
        403,
    );
    pass(
        "Product Files shortcut, linked upload, per-product filters, relinking, and unlinking work without changing file contents",
    );
    const pagePrefix = `verification-pagination/${initial.user.id}/`;
    const pageFixtures = Array.from({ length: 26 }, (_, index) => ({
        id: crypto.randomUUID(),
        object_key: pagePrefix + index,
        filename: `pagination-${index}.txt`,
    }));
    await fixtureDb`INSERT INTO seller_attachments (id,owner_id,object_key,filename,content_type,size,product_id) SELECT item.id::uuid,${initial.user.id},item.object_key,item.filename,'text/plain',1,${linkedMug} FROM jsonb_to_recordset(${JSON.stringify(pageFixtures)}::jsonb) AS item(id text,object_key text,filename text)`;
    const listedIds = [];
    let cursor = "";
    do {
        const page = await (
            await ownerContext.request.get(
                base +
                    "/api/attachments?productId=" +
                    linkedMug +
                    "&limit=10" +
                    (cursor ? "&cursor=" + encodeURIComponent(cursor) : ""),
            )
        ).json();
        assert.ok(page.attachments.length <= 10);
        listedIds.push(...page.attachments.map((file) => file.id));
        cursor = page.nextCursor || "";
    } while (cursor);
    assert.equal(listedIds.length, 27);
    assert.equal(new Set(listedIds).size, 27);
    assert.equal((await ownerContext.request.get(base + "/api/attachments?limit=0")).status(), 400);
    assert.equal(
        (await ownerContext.request.get(base + "/api/attachments?cursor=invalid")).status(),
        400,
    );
    await owner.getByLabel("Files for inventory item", { exact: true }).selectOption(linkedMug);
    await owner.waitForFunction(() => document.querySelectorAll(".attachment").length === 25);
    await owner.getByRole("button", { name: "Load more files", exact: true }).click();
    await owner.waitForFunction(() => document.querySelectorAll(".attachment").length === 27);
    await fixtureDb`DELETE FROM seller_attachments WHERE owner_id=${initial.user.id} AND object_key LIKE ${pagePrefix + "%"}`;
    await owner.getByLabel("Files for inventory item", { exact: true }).selectOption("");
    await owner.waitForFunction(() => document.querySelectorAll(".attachment").length === 1);
    pass(
        "Private file cursor pages and Load more fetch bounded batches without skipping equal-timestamp rows",
    );

    const outsider = await browser.newContext();
    const other = await outsider.request.post(base + "/api/auth/sign-up/email", {
        headers: origin,
        data: { name: "Neon E2E Other", email: `other-${email}`, password },
    });
    assert.equal(other.status(), 200, await other.text());
    const otherNotebook = await (await outsider.request.get(base + "/api/notebook")).json();
    users.push(otherNotebook.user.id);
    assert.equal(otherNotebook.document.products.length, 0);
    assert.equal(
        (await outsider.request.get(base + "/api/attachments/" + attachmentId)).status(),
        404,
    );
    assert.equal(
        (await outsider.request.get(base + "/api/attachments?productId=" + linkedMug)).status(),
        404,
    );
    assert.equal(
        (
            await outsider.request.patch(base + "/api/attachments/" + attachmentId, {
                headers: origin,
                data: { productId: null },
            })
        ).status(),
        404,
    );
    assert.equal(
        (
            await outsider.request.post(base + "/api/attachments", {
                headers: {
                    ...origin,
                    "Content-Type": "text/plain",
                    "X-File-Name": "forbidden.txt",
                    "X-Product-Id": linkedMug,
                },
                data: receipt,
            })
        ).status(),
        400,
    );
    assert.equal(
        (
            await (
                await ownerContext.request.get(base + "/api/attachments?productId=" + linkedMug)
            ).json()
        ).attachments.length,
        1,
    );

    assert.equal(
        (
            await outsider.request.get(base + "/api/realtime", {
                headers: { "X-Notebook-User": initial.user.id },
            })
        ).status(),
        401,
    );
    assert.equal(
        (await (await outsider.request.get(base + "/api/notebook")).json()).document.sidebarNote,
        "",
    );
    assert.equal(
        (await (await outsider.request.get(base + "/api/notebook")).json()).document.branding,
        null,
    );
    assert.deepEqual(
        (await (await outsider.request.get(base + "/api/notebook")).json()).document
            .stockAdjustments,
        [],
    );
    assert.deepEqual(
        (await (await outsider.request.get(base + "/api/notebook")).json()).document.refundRecords,
        [],
    );
    assert.deepEqual(
        (await (await outsider.request.get(base + "/api/notebook")).json()).document.suppliers,
        [],
    );
    pass("A second real account cannot read the owner notebook, file, or realtime subscription");
    assert.equal(otherNotebook.document.expenses.length, 0);
    await owner
        .locator("#notebook-sidebar nav")
        .getByRole("button", { name: /^Expenses/ })
        .click();
    confirmationResponse = respondToConfirmation(owner, true);
    const expenseDeleted = waitForSave(owner);
    await owner.getByRole("button", { name: "Delete E2E ad cost", exact: true }).click();
    await confirmationResponse;
    await expenseDeleted;
    await device
        .getByRole("row")
        .filter({ hasText: "E2E ad cost" })
        .waitFor({ state: "detached", timeout: 30000 });
    pass("Expense account isolation and deletion synchronize without touching inventory");

    const otherConnection = await (await outsider.request.get(base + "/api/shopee")).json();
    assert.equal(otherConnection.connected, false);
    assert.equal(
        (await outsider.request.delete(base + "/api/shopee", { headers: origin })).status(),
        200,
    );
    assert.equal(
        (await (await ownerContext.request.get(base + "/api/shopee")).json()).connected,
        true,
    );
    assert.equal(
        (await ownerContext.request.delete(base + "/api/shopee", { headers: origin })).status(),
        200,
    );
    assert.equal(
        (await (await ownerContext.request.get(base + "/api/shopee")).json()).connected,
        false,
    );
    pass("Shopee connection metadata and disconnect are isolated by real Neon account");
    for (const platform of ["lazada", "tiktok"]) {
        const endpoint = base + "/api/marketplaces/" + platform;
        assert.equal((await (await outsider.request.get(endpoint)).json()).connected, false);
        assert.equal((await outsider.request.delete(endpoint, { headers: origin })).status(), 200);
        assert.equal((await (await ownerContext.request.get(endpoint)).json()).connected, true);
        assert.equal(
            (
                await outsider.request.get(endpoint, {
                    headers: { "X-Notebook-User": initial.user.id },
                })
            ).status(),
            401,
        );
        assert.equal(
            (await ownerContext.request.delete(endpoint, { headers: origin })).status(),
            200,
        );
        assert.equal((await (await ownerContext.request.get(endpoint)).json()).connected, false);
    }
    pass(
        "Lazada and TikTok connections are private to each Neon account and disconnect independently",
    );

    const stale = await ownerContext.request.put(base + "/api/notebook", {
        headers: origin,
        data: { revision: 0, document: final.document },
    });
    assert.equal(stale.status(), 409);
    const cross = await ownerContext.request.put(base + "/api/notebook", {
        headers: { Origin: "https://unrelated.example" },
        data: { revision: final.revision, document: final.document },
    });
    assert.equal(cross.status(), 403);
    pass("Stale writes and cross-origin writes are rejected");

    const deleted = await ownerContext.request.delete(base + "/api/attachments/" + attachmentId, {
        headers: origin,
    });
    assert.equal(deleted.status(), 200);
    assert.equal(
        (await ownerContext.request.get(base + "/api/attachments/" + attachmentId)).status(),
        404,
    );
    attachmentId = null;
    pass("Object Storage attachment deletion works");
    await owner
        .locator("#notebook-sidebar nav")
        .getByRole("button", { name: /^Suppliers/ })
        .click();
    const beforePurchase = (await (await ownerContext.request.get(base + "/api/notebook")).json())
        .document;
    await owner.getByRole("button", { name: "New purchase order", exact: true }).click();
    await owner
        .getByLabel("Purchase supplier", { exact: true })
        .selectOption(beforePurchase.suppliers[0].id);
    await owner.getByRole("button", { name: "Add purchase item", exact: true }).click();
    await owner
        .getByLabel("Purchase product 1", { exact: true })
        .selectOption(beforePurchase.products.find((p) => p.sku === "E2E-MUG").id);
    await owner.getByLabel("Purchase units 1", { exact: true }).fill("5");
    await owner.getByLabel("Purchase notes", { exact: true }).fill("Test delivery");
    await owner.getByLabel("Expected delivery (optional)", { exact: true }).fill(dayBeforeSale);
    let purchaseSaved = waitForSave(owner);
    await owner.getByRole("button", { name: "Save purchase order", exact: true }).click();
    await purchaseSaved;
    const orderedPurchase = (await (await ownerContext.request.get(base + "/api/notebook")).json())
        .document.purchaseOrders[0];
    await device
        .locator("#notebook-sidebar nav")
        .getByRole("button", { name: /^Suppliers/ })
        .click();
    if (!(await device.locator(".purchase-orders").evaluate((element) => element.open)))
        await device.locator(".purchase-orders > summary").click();
    await device.getByText(orderedPurchase.reference, { exact: true }).waitFor({ timeout: 30000 });
    await owner.locator(".delivery-reminders>summary").click();
    await owner.getByLabel("Delivery view", { exact: true }).selectOption("Overdue");
    await owner.waitForFunction(
        () => document.querySelectorAll(".delivery-reminders tbody tr").length === 1,
    );
    assert.equal(await owner.locator(".delivery-reminders tbody tr").count(), 1);
    await owner
        .locator(".delivery-reminders")
        .getByRole("button", { name: "Open purchase", exact: true })
        .click();
    await owner.getByRole("button", { name: "Change expected delivery", exact: true }).waitFor();
    await owner.getByRole("button", { name: "Change expected delivery", exact: true }).click();
    await owner.getByLabel("Expected delivery date", { exact: true }).fill(saleDay);
    let scheduleSaved = waitForSave(owner);
    await owner.getByRole("button", { name: "Save expected delivery", exact: true }).click();
    await scheduleSaved;
    await owner.waitForFunction(
        () => document.querySelectorAll(".delivery-reminders tbody tr").length === 0,
    );
    assert.equal(await owner.locator(".delivery-reminders tbody tr").count(), 0);
    await owner.getByRole("button", { name: "Change expected delivery", exact: true }).click();
    await device
        .locator(".purchase-record")
        .filter({ hasText: orderedPurchase.reference })
        .locator("p.import-note")
        .filter({ hasText: "Expected " + saleDay })
        .waitFor({ state: "attached", timeout: 30000 });
    await device
        .locator(".purchase-record > summary")
        .filter({ hasText: orderedPurchase.reference })
        .click();
    await device.getByRole("button", { name: "Change expected delivery", exact: true }).click();
    await device.getByLabel("Expected delivery date", { exact: true }).fill(dayBeforeSale);
    scheduleSaved = waitForSave(device);
    await device.getByRole("button", { name: "Save expected delivery", exact: true }).click();
    await scheduleSaved;
    await owner
        .getByText(
            "This purchase changed on another device. Close and reopen the date to review the latest details.",
            { exact: true },
        )
        .waitFor({ timeout: 30000 });
    assert.equal(
        await owner
            .getByRole("button", { name: "Save expected delivery", exact: true })
            .isDisabled(),
        true,
    );
    await owner.keyboard.press("Escape");
    await device
        .locator(".purchase-record > summary")
        .filter({ hasText: orderedPurchase.reference })
        .click();
    await owner
        .locator(".delivery-reminders")
        .getByRole("button", { name: "Record delivery", exact: true })
        .click();
    await owner.getByLabel("Received now for E2E-MUG", { exact: true }).waitFor();
    assert.equal(
        await owner.getByLabel("Received now for E2E-MUG", { exact: true }).inputValue(),
        "0",
    );
    await owner.getByRole("button", { name: "Close delivery entry", exact: true }).click();
    assert.deepEqual(
        (await (await ownerContext.request.get(base + "/api/notebook")).json()).document.products,
        beforePurchase.products,
    );
    await owner
        .locator(".purchase-record > summary")
        .filter({ hasText: orderedPurchase.reference })
        .click();
    await owner.locator(".delivery-reminders>summary").click();
    await owner
        .locator("#notebook-sidebar nav")
        .getByRole("button", { name: /^Overview/ })
        .click();
    await owner.locator(".delivery-attention").click();
    await owner.getByLabel("Delivery view", { exact: true }).waitFor();
    assert.equal(await owner.locator(".breadcrumb strong").innerText(), "Suppliers");
    await owner.locator(".delivery-reminders>summary").click();
    pass(
        "Delivery reminders classify expected dates, link to purchase/receipt forms, protect stale date edits, and update the overview without changing stock",
    );
    await owner
        .locator(".purchase-record > summary")
        .filter({ hasText: orderedPurchase.reference })
        .click();
    assert.equal(
        await owner
            .locator(".purchase-overview>div")
            .filter({ hasText: "Open purchases" })
            .locator("strong")
            .innerText(),
        "1",
    );
    assert.equal(
        await owner
            .locator(".purchase-overview>div")
            .filter({ hasText: "Units outstanding" })
            .locator("strong")
            .innerText(),
        "5",
    );
    assert.equal(
        await owner
            .locator(".purchase-overview>div")
            .filter({ hasText: "Overdue deliveries" })
            .locator("strong")
            .innerText(),
        "1",
    );
    await owner.getByLabel("Purchase status", { exact: true }).selectOption("Overdue");
    await owner.waitForFunction(() => document.querySelectorAll(".purchase-record").length === 1);
    assert.equal(await owner.locator(".purchase-record").count(), 1);
    await owner
        .locator(".purchase-record")
        .first()
        .evaluate((element) => {
            element.open = true;
        });
    const purchaseDownload = owner.waitForEvent("download");
    await owner.getByRole("button", { name: "Download supplier copy", exact: true }).click();
    const purchaseCopyFile = await purchaseDownload;
    assert.match(purchaseCopyFile.suggestedFilename(), /^purchase-PO-.*\.html$/);
    const purchaseCopyText = fs.readFileSync(await purchaseCopyFile.path(), "utf8");
    assert.match(purchaseCopyText, /Little Shop/);
    assert.match(purchaseCopyText, /E2E Supply Studio/);
    assert.doesNotMatch(purchaseCopyText, /Test delivery|ajmission|<footer/i);
    const purchasePopup = owner.waitForEvent("popup");
    await owner.getByRole("button", { name: "Print purchase order", exact: true }).click();
    const printedPurchase = await purchasePopup;
    await printedPurchase.getByRole("heading", { name: "Purchase order", exact: true }).waitFor();
    fs.mkdirSync("verification/mobile", { recursive: true });
    await printedPurchase.screenshot({
        path: "verification/mobile/purchase-copy.png",
        fullPage: true,
    });
    await printedPurchase.close();
    await owner.evaluate(() => {
        window.__purchaseOpen = window.open;
        window.open = () => null;
    });
    await owner.getByRole("button", { name: "Print purchase order", exact: true }).click();
    await owner
        .getByText("Allow the purchase window to open, or download the supplier copy instead.", {
            exact: true,
        })
        .waitFor();
    await owner.evaluate(() => {
        window.open = window.__purchaseOpen;
        delete window.__purchaseOpen;
    });
    await owner.getByLabel("Purchase status", { exact: true }).selectOption("All purchases");
    await owner.locator(".purchase-record").first().waitFor();
    await owner
        .locator(".purchase-record")
        .first()
        .evaluate((element) => {
            element.open = true;
        });
    pass(
        "Branded supplier copies download/print without private notes or maker credit; filtered outstanding/overdue summaries reconcile",
    );

    confirmationResponse = respondToConfirmation(owner, false);
    await owner.getByRole("button", { name: "Receive full delivery", exact: true }).click();
    await confirmationResponse;
    assert.deepEqual(
        (await (await ownerContext.request.get(base + "/api/notebook")).json()).document.products,
        beforePurchase.products,
    );
    await device
        .locator(".purchase-record > summary")
        .filter({ hasText: orderedPurchase.reference })
        .click();
    await device.getByRole("button", { name: "Receive part of delivery", exact: true }).click();
    await device.getByLabel("Received now for E2E-MUG", { exact: true }).fill("1");
    await owner.getByRole("button", { name: "Receive part of delivery", exact: true }).click();
    await owner.getByLabel("Received now for E2E-MUG", { exact: true }).fill("2");
    confirmationResponse = respondToConfirmation(owner, true);
    purchaseSaved = waitForSave(owner);
    await owner.getByRole("button", { name: "Record received units", exact: true }).click();
    await confirmationResponse;
    await purchaseSaved;
    const firstPartial = (await (await ownerContext.request.get(base + "/api/notebook")).json())
        .document;
    assert.equal(firstPartial.purchaseOrders[0].status, "Partially received");
    assert.equal(firstPartial.purchaseOrders[0].items[0].receivedQuantity, 2);
    assert.equal(
        firstPartial.products.find((p) => p.sku === "E2E-MUG").stock,
        beforePurchase.products.find((p) => p.sku === "E2E-MUG").stock + 2,
    );
    await device
        .getByText(
            "This delivery changed on another device. Close and reopen this form to review the latest quantities.",
            { exact: true },
        )
        .waitFor({ timeout: 30000 });
    assert.equal(
        await device
            .getByRole("button", { name: "Record received units", exact: true })
            .isDisabled(),
        true,
    );
    await device.getByRole("button", { name: "Close delivery entry", exact: true }).click();
    confirmationResponse = respondToConfirmation(owner, true);
    purchaseSaved = waitForSave(owner);
    await owner.getByRole("button", { name: "Receive remaining delivery", exact: true }).click();
    await confirmationResponse;
    await purchaseSaved;
    const receivedPurchase = (await (await ownerContext.request.get(base + "/api/notebook")).json())
        .document;
    assert.equal(receivedPurchase.purchaseOrders[0].status, "Received");
    assert.equal(
        receivedPurchase.products.find((p) => p.sku === "E2E-MUG").stock,
        beforePurchase.products.find((p) => p.sku === "E2E-MUG").stock + 5,
    );
    assert.equal(
        receivedPurchase.stockAdjustments.length,
        beforePurchase.stockAdjustments.length + 2,
    );
    assert.deepEqual(receivedPurchase.expenses, beforePurchase.expenses);
    assert.equal(
        await owner.getByRole("button", { name: "Receive full delivery", exact: true }).count(),
        0,
    );
    await device
        .locator(".purchase-record > summary")
        .filter({ hasText: orderedPurchase.reference })
        .getByText("Received", { exact: true })
        .waitFor({ timeout: 30000 });
    const ownerPurchase = owner
            .locator(".purchase-record")
            .filter({ has: owner.getByText(orderedPurchase.reference, { exact: true }) }),
        devicePurchase = device
            .locator(".purchase-record")
            .filter({ has: device.getByText(orderedPurchase.reference, { exact: true }) });
    await ownerPurchase.locator(".purchase-payments>summary").click();
    await devicePurchase.locator(".purchase-payments>summary").click();
    await ownerPurchase.getByRole("button", { name: "Record a payment", exact: true }).click();
    await devicePurchase.getByRole("button", { name: "Record a payment", exact: true }).click();
    await owner.getByLabel("Purchase payment amount", { exact: true }).fill("200");
    await owner
        .getByLabel("Purchase payment reference", { exact: true })
        .fill("PRIVATE-PAYMENT-REF");
    await owner
        .getByLabel("Purchase payment notes", { exact: true })
        .fill("Private bank settlement");
    await device.getByLabel("Purchase payment amount", { exact: true }).fill("50");
    confirmationResponse = respondToConfirmation(owner, true);
    let paymentSaved = waitForSave(owner);
    await owner.getByRole("button", { name: "Save payment record", exact: true }).click();
    await confirmationResponse;
    await paymentSaved;
    await device
        .getByText(
            "This purchase changed on another device. Close and reopen payment entry to review the latest balance.",
            { exact: true },
        )
        .waitFor({ timeout: 30000 });
    assert.equal(
        await device.getByRole("button", { name: "Save payment record", exact: true }).isDisabled(),
        true,
    );
    await device.getByRole("button", { name: "Close payment entry", exact: true }).click();
    assert.equal(
        await ownerPurchase
            .locator(".purchase-payment-summary>div")
            .filter({ hasText: "Recorded payments" })
            .locator("dd")
            .innerText(),
        "₱200.00",
    );
    assert.equal(
        await ownerPurchase
            .locator(".purchase-payment-summary>div")
            .filter({ hasText: "Unrecorded item balance" })
            .locator("dd")
            .innerText(),
        "₱300.00",
    );
    const paidPurchaseDocument = (
        await (await ownerContext.request.get(base + "/api/notebook")).json()
    ).document;
    assert.deepEqual(paidPurchaseDocument.products, receivedPurchase.products);
    assert.deepEqual(paidPurchaseDocument.expenses, receivedPurchase.expenses);
    const paidCopyDownload = owner.waitForEvent("download");
    await ownerPurchase
        .getByRole("button", { name: "Download supplier copy", exact: true })
        .click();
    assert.doesNotMatch(
        fs.readFileSync(await (await paidCopyDownload).path(), "utf8"),
        /PRIVATE-PAYMENT-REF|Private bank settlement/,
    );
    const paymentId = paidPurchaseDocument.purchaseOrders[0].payments[0].id;
    confirmationResponse = respondToConfirmation(owner, false);
    await owner.getByRole("button", { name: `Remove payment ${paymentId}`, exact: true }).click();
    await confirmationResponse;
    assert.equal(
        (await (await ownerContext.request.get(base + "/api/notebook")).json()).document
            .purchaseOrders[0].payments.length,
        1,
    );
    confirmationResponse = respondToConfirmation(owner, true);
    paymentSaved = waitForSave(owner);
    await owner.getByRole("button", { name: `Remove payment ${paymentId}`, exact: true }).click();
    await confirmationResponse;
    await paymentSaved;
    await ownerPurchase.getByRole("button", { name: "Record a payment", exact: true }).click();
    await owner.getByLabel("Purchase payment amount", { exact: true }).fill("200");
    confirmationResponse = respondToConfirmation(owner, true);
    paymentSaved = waitForSave(owner);
    await owner.getByRole("button", { name: "Save payment record", exact: true }).click();
    await confirmationResponse;
    await paymentSaved;
    pass(
        "Purchase payment records save/sync privately, reconcile balances, exclude supplier copies, preserve stock/expenses, reject stale forms, and support confirmed correction",
    );

    await owner.getByRole("button", { name: "New purchase order", exact: true }).click();
    await owner
        .getByLabel("Purchase supplier", { exact: true })
        .selectOption(beforePurchase.suppliers[0].id);
    await owner.getByRole("button", { name: "Add purchase item", exact: true }).click();
    await owner
        .getByLabel("Purchase product 1", { exact: true })
        .selectOption(beforePurchase.products.find((p) => p.sku === "E2E-MUG").id);
    await owner.getByLabel("Purchase units 1", { exact: true }).fill("3");
    purchaseSaved = waitForSave(owner);
    await owner.getByRole("button", { name: "Save purchase order", exact: true }).click();
    await purchaseSaved;
    await owner.waitForFunction(() => document.querySelectorAll(".purchase-record").length === 2);
    await owner.locator(".purchase-record > summary").first().click();
    const pendingPaymentOrder = owner.locator(".purchase-record").first();
    await pendingPaymentOrder.locator(".purchase-payments>summary").click();
    await pendingPaymentOrder
        .getByRole("button", { name: "Record a payment", exact: true })
        .click();
    await owner.getByLabel("Purchase payment amount", { exact: true }).fill("200");
    confirmationResponse = respondToConfirmation(owner, true);
    const pendingPaymentSaved = waitForSave(owner);
    await owner.getByRole("button", { name: "Save payment record", exact: true }).click();
    await confirmationResponse;
    await pendingPaymentSaved;
    await owner.getByRole("button", { name: "Receive part of delivery", exact: true }).click();
    await owner.getByLabel("Received now for E2E-MUG", { exact: true }).fill("1");
    confirmationResponse = respondToConfirmation(owner, true);
    purchaseSaved = waitForSave(owner);
    await owner.getByRole("button", { name: "Record received units", exact: true }).click();
    await confirmationResponse;
    await purchaseSaved;
    const stockBeforeCancel = (
        await (await ownerContext.request.get(base + "/api/notebook")).json()
    ).document.products;
    confirmationResponse = respondToConfirmation(owner, true);
    purchaseSaved = waitForSave(owner);
    await owner.getByRole("button", { name: "Cancel remainder", exact: true }).click();
    await confirmationResponse;
    await purchaseSaved;
    assert.equal(
        await pendingPaymentOrder
            .locator(".purchase-payment-summary>div")
            .filter({ hasText: "Credit to review with supplier" })
            .locator("dd")
            .innerText(),
        "₱100.00",
    );
    const cancelledRefundStart = (
            await (await ownerContext.request.get(base + "/api/notebook")).json()
        ).document,
        refundPurchase = cancelledRefundStart.purchaseOrders[0];
    await pendingPaymentOrder.locator(".supplier-refunds>summary").click();
    await pendingPaymentOrder
        .getByRole("button", { name: "Record supplier refund", exact: true })
        .click();
    await device.locator(".purchase-record > summary").first().click();
    const deviceRefundOrder = device.locator(".purchase-record").first();
    await deviceRefundOrder.locator(".purchase-payments>summary").click();
    await deviceRefundOrder.locator(".supplier-refunds>summary").click();
    await deviceRefundOrder
        .getByRole("button", { name: "Record supplier refund", exact: true })
        .click();
    await device.getByLabel("Supplier refund amount", { exact: true }).fill("60");
    await owner.getByLabel("Supplier refund amount", { exact: true }).fill("40");
    await owner
        .getByLabel("Supplier refund reference", { exact: true })
        .fill("PRIVATE-SUPPLIER-REFUND");
    await owner
        .getByLabel("Supplier refund notes", { exact: true })
        .fill("Private supplier refund memo");
    confirmationResponse = respondToConfirmation(owner, true);
    let supplierRefundSaved = waitForSave(owner);
    await owner.getByRole("button", { name: "Save supplier refund", exact: true }).click();
    await confirmationResponse;
    await supplierRefundSaved;
    await device
        .getByText(
            "This purchase changed on another device. Close and reopen refund entry to review the latest credit.",
            { exact: true },
        )
        .waitFor({ timeout: 30000 });
    assert.equal(
        await device
            .getByRole("button", { name: "Save supplier refund", exact: true })
            .isDisabled(),
        true,
    );
    await device.getByRole("button", { name: "Close supplier refund entry", exact: true }).click();
    assert.equal(
        await pendingPaymentOrder
            .locator(".purchase-payment-summary>div")
            .filter({ hasText: "Credit to review with supplier" })
            .locator("dd")
            .innerText(),
        "₱60.00",
    );
    const withSupplierRefund = (
        await (await ownerContext.request.get(base + "/api/notebook")).json()
    ).document;
    assert.deepEqual(withSupplierRefund.products, cancelledRefundStart.products);
    assert.deepEqual(withSupplierRefund.expenses, cancelledRefundStart.expenses);
    const supplierRefundCopy = owner.waitForEvent("download");
    await pendingPaymentOrder
        .getByRole("button", { name: "Download supplier copy", exact: true })
        .click();
    assert.doesNotMatch(
        fs.readFileSync(await (await supplierRefundCopy).path(), "utf8"),
        /PRIVATE-SUPPLIER-REFUND|Private supplier refund memo/,
    );
    confirmationResponse = respondToConfirmation(owner, true);
    await pendingPaymentOrder
        .getByRole("button", {
            name: `Remove payment ${refundPurchase.payments[0].id}`,
            exact: true,
        })
        .click();
    await confirmationResponse;
    await owner
        .getByText(
            "This payment supports a supplier refund record. Correct the mistaken refund record first.",
            { exact: true },
        )
        .waitFor();
    const refundId = withSupplierRefund.purchaseOrders[0].supplierRefunds[0].id;
    confirmationResponse = respondToConfirmation(owner, false);
    await owner
        .getByRole("button", { name: `Remove supplier refund ${refundId}`, exact: true })
        .click();
    await confirmationResponse;
    assert.equal(
        (await (await ownerContext.request.get(base + "/api/notebook")).json()).document
            .purchaseOrders[0].supplierRefunds.length,
        1,
    );
    confirmationResponse = respondToConfirmation(owner, true);
    supplierRefundSaved = waitForSave(owner);
    await owner
        .getByRole("button", { name: `Remove supplier refund ${refundId}`, exact: true })
        .click();
    await confirmationResponse;
    await supplierRefundSaved;
    for (const amount of ["40", "60"]) {
        await pendingPaymentOrder
            .getByRole("button", { name: "Record supplier refund", exact: true })
            .click();
        await owner.getByLabel("Supplier refund amount", { exact: true }).fill(amount);
        confirmationResponse = respondToConfirmation(owner, true);
        supplierRefundSaved = waitForSave(owner);
        await owner.getByRole("button", { name: "Save supplier refund", exact: true }).click();
        await confirmationResponse;
        await supplierRefundSaved;
    }
    assert.equal(
        await pendingPaymentOrder
            .getByRole("button", { name: "Record supplier refund", exact: true })
            .isDisabled(),
        true,
    );
    assert.equal(
        await pendingPaymentOrder
            .locator(".purchase-payment-summary>div")
            .filter({ hasText: "Net paid after refunds" })
            .locator("dd")
            .innerText(),
        "₱100.00",
    );
    pass(
        "Supplier refunds reconcile partial/full credits, sync privately, protect payment history, exclude copies, preserve stock/expenses, and reject stale entries",
    );
    await owner
        .getByRole("button", { name: "Statement for E2E Supply Studio", exact: true })
        .click();
    await owner.getByLabel("Statement supplier", { exact: true }).waitFor();
    assert.equal(
        await owner.getByLabel("Statement supplier", { exact: true }).inputValue(),
        beforePurchase.suppliers[0].id,
    );
    await owner.waitForFunction(
        () => document.querySelectorAll(".supplier-statements tbody tr").length === 2,
    );
    assert.equal(await owner.locator(".supplier-statements tbody tr").count(), 2);
    assert.equal(
        await owner
            .locator(".supplier-statement-totals>div")
            .filter({ hasText: "Recorded payments" })
            .locator("strong")
            .innerText(),
        "₱400.00",
    );
    assert.equal(
        await owner
            .locator(".supplier-statement-totals>div")
            .filter({ hasText: "Supplier refunds received" })
            .locator("strong")
            .innerText(),
        "₱100.00",
    );
    assert.equal(
        await owner
            .locator(".supplier-statement-totals>div")
            .filter({ hasText: "Unrecorded item balance" })
            .locator("strong")
            .innerText(),
        "₱300.00",
    );
    assert.equal(
        await owner
            .locator(".supplier-statement-totals>div")
            .filter({ hasText: "Credit to review" })
            .locator("strong")
            .innerText(),
        "₱0.00",
    );
    const statementSnapshot = (
            await (await ownerContext.request.get(base + "/api/notebook")).json()
        ).document,
        statementDownload = owner.waitForEvent("download");
    await owner.getByRole("button", { name: "Export supplier statement", exact: true }).click();
    const statementFile = await statementDownload;
    assert.equal(statementFile.suggestedFilename(), "supplier-statement.csv");
    assert.equal(fs.readFileSync(await statementFile.path(), "utf8").split("\r\n").length, 3);
    const statementCopyDownload = owner.waitForEvent("download");
    await owner.getByRole("button", { name: "Download statement copy", exact: true }).click();
    const statementCopyFile = await statementCopyDownload;
    assert.equal(statementCopyFile.suggestedFilename(), "supplier-statement.html");
    const statementHtml = fs.readFileSync(await statementCopyFile.path(), "utf8");
    assert.match(statementHtml, /Little Shop/);
    assert.match(statementHtml, /E2E Supply Studio/);
    assert.doesNotMatch(statementHtml, /PRIVATE-|Private bank|ajmission|<footer/);
    assert.equal((statementHtml.match(/<tr>/g) || []).length, 3);
    const statementPrint = owner.waitForEvent("popup");
    await owner.getByRole("button", { name: "Print supplier statement", exact: true }).click();
    const statementPage = await statementPrint;
    await statementPage.getByRole("heading", { name: "Supplier statement", exact: true }).waitFor();
    fs.mkdirSync("verification/mobile", { recursive: true });
    await statementPage.screenshot({
        path: "verification/mobile/statement-copy.png",
        fullPage: true,
    });
    await statementPage.close();
    await owner.evaluate(() => {
        window.__statementOpen = window.open;
        window.open = () => null;
    });
    await owner.getByRole("button", { name: "Print supplier statement", exact: true }).click();
    await owner
        .getByText("Allow the statement window to open, or download the statement copy instead.", {
            exact: true,
        })
        .waitFor();
    await owner.evaluate(() => {
        window.open = window.__statementOpen;
        delete window.__statementOpen;
    });
    assert.deepEqual(
        (await (await ownerContext.request.get(base + "/api/notebook")).json()).document,
        statementSnapshot,
    );
    await owner.getByLabel("Statement status", { exact: true }).selectOption("Cancelled");
    await owner.waitForFunction(
        () => document.querySelectorAll(".supplier-statements tbody tr").length === 1,
    );
    assert.equal(await owner.locator(".supplier-statements tbody tr").count(), 1);
    await owner.locator(".supplier-statements>summary").click();
    await owner.locator(".supplier-statement-body").waitFor({ state: "detached" });
    assert.equal(await owner.locator(".supplier-statement-body").count(), 0);
    pass(
        "Supplier statements reconcile payments/refunds, filter supplier/status, export all matching purchases, and leave business data unchanged",
    );

    const purchasesBeforeLegacy = await (
        await ownerContext.request.get(base + "/api/notebook")
    ).json();
    const keptPurchases = purchasesBeforeLegacy.document.purchaseOrders;
    const purchaseLegacySave = await ownerContext.request.put(base + "/api/notebook", {
        headers: origin,
        data: {
            revision: purchasesBeforeLegacy.revision,
            document: purchasesBeforeLegacy.document,
        },
    });
    assert.equal(purchaseLegacySave.status(), 200);
    const purchasesAfterLegacy = (
        await (await ownerContext.request.get(base + "/api/notebook")).json()
    ).document;
    assert.deepEqual(purchasesAfterLegacy.purchaseOrders, keptPurchases);
    assert.deepEqual(purchasesAfterLegacy.products, stockBeforeCancel);
    assert.deepEqual(
        (await (await outsider.request.get(base + "/api/notebook")).json()).document.purchaseOrders,
        [],
    );
    pass(
        "Partial purchase receipts, remaining-only completion, stale-form protection, cancellation of outstanding units, live sync, backups, and privacy work",
    );

    await owner
        .getByRole("button", { name: "Open account and sync settings", exact: true })
        .click();
    await owner.getByRole("tab", { name: "Notebook", exact: true }).click();
    await owner.locator(".notebook-backup > summary").click();
    let backupEvent = owner.waitForEvent("download");
    await owner.getByRole("button", { name: "Download notebook backup", exact: true }).click();
    const originalBackup = JSON.parse(fs.readFileSync(await (await backupEvent).path(), "utf8"));
    assert.equal(originalBackup.document.purchaseOrders[0].supplierRefunds.length, 2);
    assert.equal(originalBackup.document.purchaseOrders[0].payments[0].amount, 200);
    assert.equal(originalBackup.document.purchaseOrders.length, 2);
    assert.equal(originalBackup.document.suppliers[0].name, "E2E Supply Studio");
    assert.equal(originalBackup.format, "sellers-notebook");
    assert.equal(originalBackup.document.stockAdjustments.length, 6);
    assert.ok(!("user" in originalBackup));
    const editedBackup = {
        ...originalBackup,
        document: { ...originalBackup.document, sidebarNote: "Restored from test backup" },
    };
    await owner.getByLabel("Choose notebook backup", { exact: true }).setInputFiles({
        name: "notebook-backup.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(editedBackup)),
    });
    await owner
        .getByLabel("I understand this replaces my current notebook data.", { exact: true })
        .check();
    assert.equal(
        await owner
            .getByRole("button", { name: "Restore reviewed backup", exact: true })
            .isDisabled(),
        true,
    );
    backupEvent = owner.waitForEvent("download");
    await owner.getByRole("button", { name: "Download notebook backup", exact: true }).click();
    await backupEvent;
    confirmationResponse = respondToConfirmation(owner, false);
    await owner.getByRole("button", { name: "Restore reviewed backup", exact: true }).click();
    await confirmationResponse;
    assert.equal(
        (await (await ownerContext.request.get(base + "/api/notebook")).json()).document
            .sidebarNote,
        originalBackup.document.sidebarNote,
    );
    confirmationResponse = respondToConfirmation(owner, true);
    const restored = waitForSave(owner);
    await owner.getByRole("button", { name: "Restore reviewed backup", exact: true }).click();
    await confirmationResponse;
    await restored;
    assert.equal(
        (await (await ownerContext.request.get(base + "/api/notebook")).json()).document
            .sidebarNote,
        "Restored from test backup",
    );
    await device.waitForFunction(
        () =>
            document.querySelector("#sidebar-personal-note")?.value === "Restored from test backup",
    );
    assert.equal(
        (await (await outsider.request.get(base + "/api/notebook")).json()).document.sidebarNote,
        "",
    );
    await owner.getByLabel("Choose notebook backup", { exact: true }).setInputFiles({
        name: "undo-backup.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(originalBackup)),
    });
    backupEvent = owner.waitForEvent("download");
    await owner.getByRole("button", { name: "Download notebook backup", exact: true }).click();
    await backupEvent;
    await owner
        .getByLabel("I understand this replaces my current notebook data.", { exact: true })
        .check();
    confirmationResponse = respondToConfirmation(owner, true);
    const undone = waitForSave(owner);
    await owner.getByRole("button", { name: "Restore reviewed backup", exact: true }).click();
    await confirmationResponse;
    await undone;
    assert.equal(
        (await (await ownerContext.request.get(base + "/api/notebook")).json()).document
            .sidebarNote,
        originalBackup.document.sidebarNote,
    );
    pass(
        "Notebook backups download, require a current checkpoint and confirmation, restore privately, sync, and support undo by restoring the previous backup",
    );
    await owner.getByRole("tab", { name: "Branding", exact: true }).click();
    const resetBranding = waitForSave(owner);
    await owner.getByRole("button", { name: "Reset branding", exact: true }).click();
    await resetBranding;
    assert.equal(
        (await (await ownerContext.request.get(base + "/api/notebook")).json()).document.branding,
        null,
    );
    await owner.getByRole("button", { name: "Close account", exact: true }).click();
    assert.equal(await owner.title(), "Seller’s Notebook — Your business, beautifully kept");
    pass("Reset branding restores the default notebook identity and page title");
    await owner
        .locator("#notebook-sidebar nav")
        .getByRole("button", { name: /^Suppliers/ })
        .click();
    confirmationResponse = respondToConfirmation(owner, false);
    await owner
        .getByRole("button", { name: "Delete supplier E2E Supply Studio", exact: true })
        .click();
    await confirmationResponse;
    await owner.getByText("E2E Supply Studio", { exact: true }).waitFor();
    const beforeSupplierDelete = (
        await (await ownerContext.request.get(base + "/api/notebook")).json()
    ).document;
    confirmationResponse = respondToConfirmation(owner, true);
    const supplierDeleted = waitForSave(owner);
    await owner
        .getByRole("button", { name: "Delete supplier E2E Supply Studio", exact: true })
        .click();
    await confirmationResponse;
    await supplierDeleted;
    const afterSupplierDelete = (
        await (await ownerContext.request.get(base + "/api/notebook")).json()
    ).document;
    assert.deepEqual(afterSupplierDelete.suppliers, []);
    assert.deepEqual(afterSupplierDelete.products, beforeSupplierDelete.products);
    pass("Supplier deletion requires confirmation and preserves all inventory and stock");
    await owner.locator(".supplier-statements>summary").click();
    await owner
        .getByLabel("Statement supplier", { exact: true })
        .getByRole("option", { name: "E2E Supply Studio · Archived supplier", exact: true })
        .waitFor({ state: "attached" });
    await owner
        .getByLabel("Statement supplier", { exact: true })
        .selectOption(beforePurchase.suppliers[0].id);
    await owner.waitForFunction(
        () =>
            document.querySelector('[aria-label="Statement supplier"] option:checked')
                ?.textContent === "E2E Supply Studio · Archived supplier",
    );
    assert.equal(
        await owner
            .getByLabel("Statement supplier", { exact: true })
            .getByRole("option", { selected: true })
            .innerText(),
        "E2E Supply Studio · Archived supplier",
    );
    await owner.waitForFunction(
        () => document.querySelectorAll(".supplier-statements tbody tr").length === 2,
    );
    assert.equal(await owner.locator(".supplier-statements tbody tr").count(), 2);
    await owner.locator(".supplier-statements>summary").click();
    pass("Supplier statements retain archived supplier purchase history after contact deletion");

    await owner.getByText("Saved to your account", { exact: true }).waitFor();
    await owner
        .getByRole("button", { name: "Open account and sync settings", exact: true })
        .click();
    await owner.getByRole("tab", { name: "Notebook", exact: true }).click();
    const beforeSample = (await (await ownerContext.request.get(base + "/api/notebook")).json())
        .document;
    await owner.evaluate(() => {
        localStorage.setItem("sellerdesk-v1", JSON.stringify({ products: [], orders: [] }));
        localStorage.removeItem("sellers-notebook-sample-v2");
    });
    await owner.getByRole("button", { name: "Explore sample notebook", exact: true }).click();
    await owner.getByText("Paper & Parcel · Sample Shop", { exact: true }).waitFor();
    await owner.waitForFunction(
        () =>
            JSON.parse(localStorage.getItem("sellers-notebook-sample-v2") || "{}").products
                ?.length >= 100,
    );
    const sampleData = await owner.evaluate(() =>
        JSON.parse(localStorage.getItem("sellers-notebook-sample-v2")),
    );
    await owner
        .locator("#notebook-sidebar nav")
        .getByRole("button", { name: /^Overview/ })
        .click();
    const overviewSections = owner.locator(
        ".chart-row > .collapsible-card,.bottom-row > .collapsible-card",
    );
    assert.equal(await overviewSections.count(), 4);
    for (let index = 0; index < 4; index++) {
        const section = overviewSections.nth(index);
        await section.locator(":scope > summary").click();
        assert.equal(await section.getAttribute("open"), null);
        await section.locator(":scope > summary").click();
    }
    pass("Overview charts and supporting panels use consistent collapsible section headers");

    for (const list of ["products", "orders", "expenses", "stockAdjustments", "refundRecords"])
        assert.ok(sampleData[list].length >= 100);
    await owner
        .locator("#notebook-sidebar nav")
        .getByRole("button", { name: /^Inventory/ })
        .click();
    await owner.getByRole("navigation", { name: "Inventory pagination", exact: true }).waitFor();
    assert.equal(await owner.locator(".inventory-card tbody tr").count(), 25);
    assert.equal(await owner.locator(".stock-adjustment-body").count(), 0);
    const firstProduct = await owner.locator(".inventory-card tbody tr").first().innerText();
    await owner.getByRole("button", { name: "Inventory: Next page", exact: true }).click();
    assert.notEqual(
        await owner.locator(".inventory-card tbody tr").first().innerText(),
        firstProduct,
    );
    await owner.getByLabel("Inventory rows per page", { exact: true }).selectOption("50");
    assert.equal(await owner.locator(".inventory-card tbody tr").count(), 50);
    await owner.getByPlaceholder("Search products…", { exact: true }).fill("TOTE-001");
    assert.equal(await owner.locator(".inventory-card tbody tr").count(), 1);
    assert.equal(
        await owner.getByRole("button", { name: "Inventory: Next page", exact: true }).isDisabled(),
        true,
    );
    await owner.getByPlaceholder("Search products…", { exact: true }).fill("");
    await owner.getByLabel("Inventory rows per page", { exact: true }).selectOption("25");
    await owner.locator(".stock-adjustments > summary").click();
    await owner
        .getByRole("navigation", { name: "Stock history pagination", exact: true })
        .waitFor();
    assert.equal(await owner.locator(".stock-adjustments tbody tr").count(), 25);
    await owner.getByRole("button", { name: "Stock history: Next page", exact: true }).click();
    await owner.locator(".stock-adjustments > summary").click();
    await owner
        .locator("#notebook-sidebar nav")
        .getByRole("button", { name: /^Orders/ })
        .click();
    await owner.getByLabel("Date range", { exact: true }).selectOption("all");
    const ordersCard = owner
        .locator(".card")
        .filter({ has: owner.getByRole("heading", { name: "All orders", exact: true }) });
    assert.equal(await ordersCard.locator("tbody tr").count(), 25);
    await owner.getByRole("button", { name: "Orders: Next page", exact: true }).click();
    const allOrderExport = owner.waitForEvent("download");
    await owner.getByRole("button", { name: "Export", exact: true }).click();
    const exportedOrders = fs.readFileSync(await (await allOrderExport).path(), "utf8");
    assert.equal(exportedOrders.trim().split(/\r?\n/).length, 361);
    await owner
        .locator("#notebook-sidebar nav")
        .getByRole("button", { name: /^Expenses/ })
        .click();
    await owner.getByRole("navigation", { name: "Expenses pagination", exact: true }).waitFor();
    assert.equal(await owner.locator(".expense-list tbody tr").count(), 25);
    await owner.getByRole("button", { name: "Expenses: Next page", exact: true }).click();
    const allExpenseExport = owner.waitForEvent("download");
    await owner.getByRole("button", { name: "Export expenses", exact: true }).click();
    const exportedExpenses = fs.readFileSync(await (await allExpenseExport).path(), "utf8");
    assert.equal(exportedExpenses.trim().split(/\r?\n/).length, 121);
    pass(
        "Sample lists paginate, filters reset pages, collapsed histories defer their contents, and exports retain all filtered records",
    );

    await owner.getByLabel("A note to yourself", { exact: true }).fill("Sample-only note edit");
    await owner.waitForFunction(
        () =>
            JSON.parse(localStorage.getItem("sellers-notebook-sample-v2") || "{}").sidebarNote ===
            "Sample-only note edit",
    );
    assert.deepEqual(
        (await (await ownerContext.request.get(base + "/api/notebook")).json()).document,
        beforeSample,
    );
    assert.deepEqual(
        await owner.evaluate(() => JSON.parse(localStorage.getItem("sellerdesk-v1"))),
        { products: [], orders: [] },
    );
    await owner
        .getByRole("button", { name: "Open account and sync settings", exact: true })
        .click();
    await owner.getByRole("tab", { name: "Notebook", exact: true }).click();
    await owner.getByRole("button", { name: "Open my notebook", exact: true }).click();
    await owner.getByText("Live across your devices", { exact: true }).waitFor({ timeout: 30000 });
    assert.deepEqual(
        (await (await ownerContext.request.get(base + "/api/notebook")).json()).document,
        beforeSample,
    );
    pass(
        "Expanded sample has 100+ records in every business collection, upgrades legacy sample sessions, and keeps edits separate from the cloud account",
    );
    await owner
        .getByRole("button", { name: "Open account and sync settings", exact: true })
        .click();
    await owner.getByRole("tab", { name: "Notebook", exact: true }).click();
    await owner.getByRole("button", { name: "Sign out", exact: true }).click();
    await owner.waitForURL(base + "/");
    await owner.getByRole("heading", { name: /Your business deserves/ }).waitFor();
    assert.equal((await ownerContext.request.get(base + "/api/notebook")).status(), 401);
    assert.equal(await owner.getByText("Realtime test mug", { exact: true }).count(), 0);
    pass("Sign-out removes the account session and previous user rows");

    await owner.setViewportSize({ width: 390, height: 844 });
    await owner.goto(base + "/auth/sign-in");
    assert.equal(
        await owner.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
    );
    assert.equal(await owner.getByText("Sign in with ChatGPT", { exact: true }).count(), 0);
    await owner.goto(base + "/auth/reset-password");
    assert.equal(new URL(owner.url()).pathname, "/auth/reset-password");
    assert.deepEqual(errors, []);
    pass("Mobile auth layout, signed-out reset page, and browser error checks pass");
}

(async () => {
    let failure;
    try {
        await run();
    } catch (e) {
        failure = e;
        console.error(
            "FAIL",
            String(e.message || e).split("\n")[0],
            typeof e.actual === "number" ? { actual: e.actual, expected: e.expected } : {},
            String(e.stack || "")
                .split("\n")
                .find((line) => line.includes("verify-neon.cjs")) || "",
        );
        if (ownerContext) {
            const page = ownerContext.pages()[0];
            await page
                .screenshot({ path: "verification/failure.png", fullPage: true })
                .catch(() => {});
            console.error(
                "Supplier editor",
                await page.locator(".supplier-editor").count(),
                await page
                    .locator(".supplier-editor")
                    .getAttribute("open")
                    .catch(() => null),
            );
        }
    } finally {
        if (ownerContext)
            await ownerContext.request
                .delete(base + "/api/profile-picture", { headers: origin })
                .catch(() => {});
        if (attachmentId && ownerContext)
            await ownerContext.request
                .delete(base + "/api/attachments/" + attachmentId, { headers: origin })
                .catch(() => {});
        if (users.length) {
            try {
                const { neon } = require("@neondatabase/serverless");
                const sql = neon(process.env.DATABASE_URL);
                for (const id of users) {
                    await sql`DELETE FROM seller_marketplace_auth_states WHERE owner_id=${id}`;
                    await sql`DELETE FROM seller_marketplace_connections WHERE owner_id=${id}`;
                    await sql`DELETE FROM seller_shopee_auth_states WHERE owner_id=${id}`;
                    await sql`DELETE FROM seller_shopee_connections WHERE owner_id=${id}`;
                    await sql`DELETE FROM seller_attachments WHERE owner_id=${id}`;
                    await sql`DELETE FROM seller_notebooks WHERE owner_id=${id}`;
                    const cli =
                        process.env.NEON_CLI_PATH ||
                        path.join(process.env.APPDATA || "", "npm/node_modules/neon/dist/cli.js");
                    await execFile(process.execPath, [cli, "neon-auth", "user", "delete", id], {
                        cwd: process.cwd(),
                        windowsHide: true,
                    });
                }
                pass("Temporary test data and test accounts cleaned up");
            } catch (e) {
                failure = failure || e;
                console.error("FAIL test cleanup:", e.message);
            }
        }
        await browser?.close();
        fs.mkdirSync("verification", { recursive: true });
        fs.writeFileSync(
            "verification/neon-e2e.json",
            JSON.stringify(
                {
                    verifiedAt: new Date().toISOString(),
                    baseUrl: base,
                    passed: !failure,
                    checks,
                    failure: failure ? String(failure.message).split("\n")[0] : null,
                },
                null,
                2,
            ) + "\n",
        );
    }
    process.exitCode = failure ? 1 : 0;
})();
