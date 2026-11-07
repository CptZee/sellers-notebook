const { chromium } = require("@playwright/test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { promisify } = require("node:util");
require("@next/env").loadEnvConfig(process.cwd());
const base = "http://127.0.0.1:3000";
const output = process.env.MOBILE_QA_DIR || "verification/mobile";
const results = [];
async function respondToConfirmation(page, accept = true) {
    const dialog = page.getByRole("dialog", { name: "Please confirm", exact: true });
    await dialog.waitFor();
    await dialog.getByRole("button", { name: accept ? "Continue" : "Cancel", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
}
let confirmationResponse;
(async () => {
    let browser, context, userId, failure;
    try {
        fs.mkdirSync(output, { recursive: true });
        browser = await chromium.launch({ channel: "msedge", headless: true });
        context = await browser.newContext({ viewport: { width: 390, height: 844 } });
        const page = await context.newPage();
        await page.goto(base + "/auth/sign-up");
        const password = crypto.randomBytes(24).toString("base64url");
        await page.getByLabel("Your name").fill("Mobile layout review");
        await page.getByLabel("Email address").fill(`notebook-mobile-${Date.now()}@example.com`);
        await page.getByLabel("Password", { exact: true }).fill(password);
        await page.getByLabel("Confirm password", { exact: true }).fill(password);
        await page.getByRole("button", { name: "Create account", exact: true }).click();
        await page.waitForURL(base + "/notebook");
        userId = (await (await context.request.get(base + "/api/notebook")).json()).user.id;
        await page.getByText("Live across your devices", { exact: true }).waitFor();
        assert.equal(
            await page.locator("footer .maker-credit a").innerText(),
            "Aaron James R. Mission",
        );
        assert.equal(
            await page.locator("footer .maker-credit a").getAttribute("href"),
            "https://ajmission.dev",
        );
        await page.getByRole("button", { name: "Show sidebar", exact: true }).click();
        assert.match(
            await page.locator("#notebook-sidebar nav > button").last().innerText(),
            /Pricing calculator/,
        );
        await page.locator(".sidebar-close").click();
        await page.getByRole("button", { name: "Quick create", exact: true }).click();
        let quickMenu = page.getByRole("group", { name: "Create a new entry", exact: true });
        assert.equal(
            await quickMenu.getByRole("button", { name: /^Record a sale/ }).isDisabled(),
            true,
        );
        assert.equal(
            await quickMenu.getByRole("button", { name: /^New purchase order/ }).isDisabled(),
            true,
        );
        assert.equal(
            await quickMenu.getByRole("button", { name: /^Purchase payment/ }).isDisabled(),
            true,
        );
        assert.equal(
            await quickMenu.getByRole("button", { name: /^Supplier refund/ }).isDisabled(),
            true,
        );
        await page.keyboard.press("Escape");
        assert.equal(
            await page.getByRole("group", { name: "Create a new entry", exact: true }).count(),
            0,
        );
        assert.equal(
            await page
                .getByRole("button", { name: "Quick create", exact: true })
                .evaluate((el) => el === document.activeElement),
            true,
        );
        for (const height of [900, 1000, 1100]) {
            await page.setViewportSize({ width: 1440, height });
            const sidebar = page.locator("#notebook-sidebar");
            assert.equal(
                await sidebar.evaluate((el) => getComputedStyle(el).scrollbarWidth),
                "none",
            );
            const note = page.locator(".personal-note");
            if (await note.isVisible()) {
                const last = await page
                        .locator("#notebook-sidebar nav > button")
                        .last()
                        .boundingBox(),
                    box = await note.boundingBox();
                assert.ok(
                    box.y >= last.y + last.height + 12,
                    "Note must have clear space beneath Suppliers",
                );
            }
            await page.screenshot({ path: path.join(output, `sidebar-${height}.png`) });
        }
        await page.setViewportSize({ width: 390, height: 844 });
        async function navigate(name) {
            if (!(await page.locator("#notebook-sidebar").isVisible()))
                await page.getByRole("button", { name: "Show sidebar", exact: true }).click();
            await page
                .locator("#notebook-sidebar nav")
                .getByRole("button", { name: new RegExp("^" + name) })
                .click();
        }
        async function inspect(name) {
            const size = await page.evaluate(() => ({
                width: innerWidth,
                scroll: document.documentElement.scrollWidth,
            }));
            results.push({ name, ...size });
            console.log("CHECK", name, JSON.stringify(size));
            await page.screenshot({
                path: path.join(output, name + ".png"),
                fullPage: (await page.getByRole("dialog").count()) === 0,
            });
        }
        await page.getByRole("button", { name: "Show sidebar", exact: true }).click();
        await page
            .getByRole("button", { name: "Open account and sync settings", exact: true })
            .click();
        await page.getByRole("tab", { name: "Notebook", exact: true }).click();
        await page.getByRole("button", { name: "Explore sample notebook", exact: true }).click();
        if (
            await page
                .getByRole("button", { name: "Hide sidebar", exact: true })
                .first()
                .isVisible()
        )
            await page.locator(".sidebar-close").click();
        await navigate("Inventory");
        await page.locator(".restock-plan > summary").click();
        await page
            .getByLabel("Restock supplier", { exact: true })
            .selectOption("sample-supplier-1");
        const restockBefore = await page.evaluate(() =>
            JSON.parse(localStorage.getItem("sellers-notebook-sample-v2")),
        );
        const incomingPlanRow = page.locator(".restock-plan tbody tr").first();
        assert.equal(await incomingPlanRow.locator("td").nth(6).innerText(), "5");
        assert.equal(await incomingPlanRow.locator("td").nth(7).innerText(), "15");
        const incomingPlanDownload = page.waitForEvent("download");
        await page.getByRole("button", { name: "Export restock plan", exact: true }).click();
        const incomingCsv = fs.readFileSync(await (await incomingPlanDownload).path(), "utf8");
        assert.ok(incomingCsv.includes("On order (all suppliers)"));
        assert.ok(incomingCsv.includes("Additional units to buy"));
        await inspect("390-restock-incoming");

        await page.getByLabel("Restock supplier", { exact: true }).selectOption("all");
        await page.getByRole("button", { name: "Restock plan: Next page", exact: true }).click();
        await page
            .getByLabel("Restock view", { exact: true })
            .selectOption("Covered by incoming stock");
        assert.equal(
            await page
                .getByRole("button", { name: "Export restock plan", exact: true })
                .isDisabled(),
            true,
        );
        await page.getByLabel("Restock view", { exact: true }).selectOption("Needs buying");
        await page
            .getByLabel("Search restock products", { exact: true })
            .fill(restockBefore.products[0].sku);
        assert.equal(await page.locator(".restock-plan tbody tr").count(), 1);
        assert.equal(
            await page
                .getByRole("button", { name: "Restock plan: Previous page", exact: true })
                .isDisabled(),
            true,
        );
        await page
            .getByLabel("Restock supplier", { exact: true })
            .selectOption("sample-supplier-1");
        await page.getByRole("button", { name: "Prepare purchase order", exact: true }).click();
        await page.getByRole("dialog", { name: "New purchase order", exact: true }).waitFor();
        assert.equal(await page.locator(".breadcrumb strong").innerText(), "Suppliers");
        assert.equal(
            await page.getByLabel("Purchase supplier", { exact: true }).inputValue(),
            "sample-supplier-1",
        );
        const restockProduct = restockBefore.products.find(
            (p) => p.id === restockBefore.suppliers[0].productIds[0],
        );
        const incomingUnits = restockBefore.purchaseOrders
            .filter((po) => ["Ordered", "Partially received"].includes(po.status))
            .flatMap((po) => po.items)
            .filter((item) => item.productId === restockProduct.id)
            .reduce((n, item) => n + item.quantity - (item.receivedQuantity || 0), 0);
        assert.equal(
            Number(await page.getByLabel("Purchase units 1", { exact: true }).inputValue()),
            restockProduct.targetStock - restockProduct.stock - incomingUnits,
        );
        await inspect("390-restock-purchase-draft");
        await page.getByRole("button", { name: "Cancel purchase entry", exact: true }).click();
        assert.deepEqual(
            await page.evaluate(
                () => JSON.parse(localStorage.getItem("sellers-notebook-sample-v2")).purchaseOrders,
            ),
            restockBefore.purchaseOrders,
        );
        async function quick(label) {
            await page.getByRole("button", { name: "Quick create", exact: true }).click();
            assert.equal(await page.getByText("A fresh page", { exact: true }).count(), 0);
            await page
                .getByRole("group", { name: "Create a new entry", exact: true })
                .getByRole("button", { name: label, exact: true })
                .click();
            const expected =
                label === "New product"
                    ? "Inventory"
                    : label === "Record a sale"
                      ? "Orders"
                      : label === "New expense"
                        ? "Expenses"
                        : "Suppliers";
            await page.waitForFunction(
                (expected) =>
                    document.querySelector(".breadcrumb strong")?.textContent === expected,
                expected,
            );
        }
        await quick("New expense");
        await page.getByRole("dialog", { name: "New expense", exact: true }).waitFor();
        assert.equal(await page.locator(".breadcrumb strong").innerText(), "Expenses");
        assert.equal(await page.locator(".shell").evaluate((el) => el.inert), true);
        assert.equal(
            await page.getByRole("button", { name: "Quick create", exact: true }).count(),
            0,
        );
        await page.waitForFunction(() => document.activeElement?.getAttribute("name") === "title");
        await page.getByRole("button", { name: "Add expense", exact: true }).focus();
        await page.keyboard.press("Tab");
        assert.equal(
            await page
                .getByRole("button", { name: "Close dialog", exact: true })
                .evaluate((el) => el === document.activeElement),
            true,
        );
        await page.keyboard.press("Shift+Tab");
        assert.equal(
            await page
                .getByRole("button", { name: "Add expense", exact: true })
                .evaluate((el) => el === document.activeElement),
            true,
        );
        await page.keyboard.press("Escape");
        assert.equal(await page.getByRole("dialog").count(), 0);
        assert.equal(await page.locator(".shell").evaluate((el) => el.inert), false);
        assert.equal(
            await page
                .getByRole("button", { name: "Quick create", exact: true })
                .evaluate((el) => el === document.activeElement),
            true,
        );
        await quick("New expense");
        await page.getByLabel("Expense title", { exact: true }).fill(" ");
        await page.getByLabel("Amount (₱)", { exact: true }).fill("1");
        await page.getByRole("button", { name: "Add expense", exact: true }).click();
        await page
            .getByText(
                "Enter a title and a positive amount with no more than two decimal places.",
                { exact: true },
            )
            .waitFor();
        await page.keyboard.press("Escape");
        await quick("New expense");
        assert.equal(
            await page
                .getByText(
                    "Enter a title and a positive amount with no more than two decimal places.",
                    { exact: true },
                )
                .count(),
            0,
        );
        await page.getByLabel("Expense title", { exact: true }).fill("Quick modal expense");
        await page.getByLabel("Amount (₱)", { exact: true }).fill("1");
        await page.getByRole("button", { name: "Add expense", exact: true }).click();
        await page.waitForFunction(() =>
            JSON.parse(localStorage.getItem("sellers-notebook-sample-v2") || "{}").expenses?.some(
                (e) => e.title === "Quick modal expense",
            ),
        );
        assert.equal(await page.locator(".breadcrumb strong").innerText(), "Expenses");
        assert.equal(await page.getByRole("dialog").count(), 0);
        await quick("New product");
        await page.getByRole("dialog", { name: "New product", exact: true }).waitFor();
        assert.equal(
            await page.getByRole("button", { name: "Quick create", exact: true }).count(),
            0,
        );
        await page.getByRole("button", { name: "Cancel", exact: true }).click();
        await quick("Record a sale");
        await page.getByRole("dialog", { name: "Record a sale", exact: true }).waitFor();
        await page.getByRole("button", { name: "Cancel", exact: true }).click();
        await quick("New supplier");
        await page.getByRole("dialog", { name: "New supplier", exact: true }).waitFor();
        await page.getByLabel("Supplier name", { exact: true }).fill("Quick supplier draft");
        await page.mouse.click(3, 3);
        assert.equal(await page.getByRole("dialog").count(), 0);
        assert.equal(await page.locator(".breadcrumb strong").innerText(), "Suppliers");
        await quick("New purchase order");
        await page.getByRole("dialog", { name: "New purchase order", exact: true }).waitFor();
        await page
            .getByLabel("Purchase supplier", { exact: true })
            .selectOption("sample-supplier-1");
        await page.getByRole("button", { name: "Add purchase item", exact: true }).click();
        await page.getByLabel("Purchase product 1", { exact: true }).selectOption({ index: 1 });
        await page.getByLabel("Purchase units 1", { exact: true }).fill("3");
        await page.getByRole("button", { name: "Cancel purchase entry", exact: true }).click();
        await quick("New purchase order");
        assert.equal(await page.getByLabel("Purchase supplier", { exact: true }).inputValue(), "");
        assert.equal(await page.locator(".purchase-line").count(), 0);
        await page.keyboard.press("Escape");
        assert.equal(await page.locator(".breadcrumb strong").innerText(), "Suppliers");
        await quick("Purchase payment");
        await page.getByRole("dialog", { name: "Record purchase payment", exact: true }).waitFor();
        await page
            .getByLabel("Purchase for financial entry", { exact: true })
            .selectOption({ index: 1 });
        await page.getByLabel("Purchase payment amount", { exact: true }).fill("1");
        await page.getByRole("button", { name: "Save payment record", exact: true }).click();
        await page.getByRole("dialog", { name: "Please confirm", exact: true }).waitFor();
        await inspect("390-styled-confirmation");
        await page
            .getByRole("dialog", { name: "Please confirm", exact: true })
            .getByRole("button", { name: "Cancel", exact: true })
            .click();
        await page
            .getByRole("dialog", { name: "Please confirm", exact: true })
            .waitFor({ state: "hidden" });
        assert.equal(
            await page
                .getByRole("dialog", { name: "Record purchase payment", exact: true })
                .count(),
            1,
        );
        assert.equal(
            await page.getByLabel("Purchase payment amount", { exact: true }).inputValue(),
            "1",
        );
        confirmationResponse = respondToConfirmation(page, true);
        await page.getByRole("button", { name: "Save payment record", exact: true }).click();
        await confirmationResponse;
        await page
            .getByRole("dialog", { name: "Record purchase payment", exact: true })
            .waitFor({ state: "hidden" });
        assert.equal(await page.locator(".shell").evaluate((el) => el.inert), false);
        assert.equal(await page.locator(".breadcrumb strong").innerText(), "Suppliers");
        await navigate("Inventory");
        await navigate("Suppliers");
        assert.equal(await page.locator(".purchase-form").count(), 0);
        await page.getByRole("button", { name: "Quick create", exact: true }).click();
        await page.locator("h1").click();
        assert.equal(
            await page.getByRole("group", { name: "Create a new entry", exact: true }).count(),
            0,
        );
        console.log(
            "PASS All five quick-create actions open consistent modals on their destination tabs; focus trap, Escape/backdrop dismissal, cancellation and expense saving work",
        );
        for (const width of [320, 390, 768]) {
            await page.setViewportSize({ width, height: 844 });
            for (const tab of [
                "Overview",
                "Inventory",
                "Orders",
                "Expenses",
                "Pricing calculator",
                "Suppliers",
            ]) {
                await navigate(tab);
                assert.equal(
                    await page
                        .getByRole("button", { name: "Quick create", exact: true })
                        .isVisible(),
                    true,
                );
                await inspect(width + "-" + tab.replaceAll(" ", "-"));
                if (tab === "Overview") {
                    await page.getByRole("button", { name: "Quick create", exact: true }).click();
                    await inspect(width + "-quick-create");
                    await page.keyboard.press("Escape");
                }
                if (tab === "Pricing calculator") {
                    assert.equal(await page.locator(".calculator-form > summary").count(), 0);
                    await page.getByLabel("Tax allowance (%)", { exact: true }).fill("5");
                    assert.equal(
                        await page
                            .locator(".price-line")
                            .filter({ hasText: "Tax allowance" })
                            .locator("strong")
                            .innerText(),
                        "₱14.50",
                    );
                }
                if (tab === "Suppliers") {
                    await page
                        .getByRole("navigation", { name: "Suppliers pagination", exact: true })
                        .waitFor();
                    assert.equal(await page.locator(".supplier-manager tbody tr").count(), 25);
                    await page.getByRole("button", { name: "Add supplier", exact: true }).click();
                    await inspect(width + "-supplier-editor");
                    await page
                        .getByRole("button", { name: "Cancel supplier edit", exact: true })
                        .click();
                    await page
                        .getByRole("button", { name: "Import suppliers CSV", exact: true })
                        .click();
                    await page.getByLabel("Choose supplier CSV", { exact: true }).setInputFiles({
                        name: "suppliers.csv",
                        mimeType: "text/csv",
                        buffer: Buffer.from("Supplier,Email\nMobile CSV studio,mobile@example.com"),
                    });
                    await page.getByText("1 new suppliers", { exact: true }).waitFor();
                    await inspect(width + "-supplier-import");
                    await page
                        .getByRole("button", { name: "Close supplier importer", exact: true })
                        .click();
                    await page
                        .getByRole("button", { name: "New purchase order", exact: true })
                        .click();
                    await page
                        .getByLabel("Purchase supplier", { exact: true })
                        .selectOption("sample-supplier-1");
                    await page
                        .getByRole("button", { name: "Add purchase item", exact: true })
                        .click();
                    await page
                        .getByLabel("Purchase product 1", { exact: true })
                        .selectOption({ index: 1 });
                    await inspect(width + "-purchase-form");
                    await page
                        .getByRole("button", { name: "Cancel purchase entry", exact: true })
                        .click();
                    await page.locator(".purchase-record > summary").first().click();
                    await inspect(width + "-purchase-detail");
                    await page
                        .getByRole("button", { name: "Receive part of delivery", exact: true })
                        .click();
                    await page.locator(".partial-receipt input[type=number]").first().fill("1");
                    await inspect(width + "-partial-receipt");
                    await page
                        .getByRole("button", { name: "Close delivery entry", exact: true })
                        .click();
                    await page
                        .locator(".purchase-record")
                        .first()
                        .locator(".purchase-payments>summary")
                        .click();
                    await page
                        .getByRole("button", { name: "Record a payment", exact: true })
                        .click();
                    await page.getByLabel("Purchase payment amount", { exact: true }).fill("1");
                    await inspect(width + "-purchase-payment");
                    await page
                        .getByRole("button", { name: "Close payment entry", exact: true })
                        .click();
                    assert.equal(await page.locator(".supplier-statement-body").count(), 0);
                    await page.locator(".supplier-statements>summary").click();
                    await page
                        .getByRole("navigation", {
                            name: "Supplier statement pagination",
                            exact: true,
                        })
                        .waitFor();
                    assert.equal(await page.locator(".supplier-statements tbody tr").count(), 25);
                    await page
                        .getByRole("button", { name: "Supplier statement: Next page", exact: true })
                        .click();
                    const statementExport = page.waitForEvent("download");
                    await page
                        .getByRole("button", { name: "Export supplier statement", exact: true })
                        .click();
                    assert.equal(
                        fs.readFileSync(await (await statementExport).path(), "utf8").split("\r\n")
                            .length,
                        101,
                    );
                    const statementHtmlDownload = page.waitForEvent("download");
                    await page
                        .getByRole("button", { name: "Download statement copy", exact: true })
                        .click();
                    const html = fs.readFileSync(
                        await (await statementHtmlDownload).path(),
                        "utf8",
                    );
                    assert.equal((html.match(/<tr>/g) || []).length, 101);
                    await page
                        .getByLabel("Statement supplier", { exact: true })
                        .selectOption("sample-supplier-1");
                    assert.equal(await page.locator(".supplier-statements tbody tr").count(), 1);
                    assert.equal(
                        await page
                            .getByRole("button", {
                                name: "Supplier statement: Previous page",
                                exact: true,
                            })
                            .isDisabled(),
                        true,
                    );
                    await inspect(width + "-supplier-statement");
                    await page.locator(".supplier-statements>summary").click();
                    await page.locator(".delivery-reminders>summary").click();
                    await page
                        .getByRole("navigation", {
                            name: "Delivery reminders pagination",
                            exact: true,
                        })
                        .waitFor();
                    assert.equal(await page.locator(".delivery-reminders tbody tr").count(), 25);
                    await page
                        .getByRole("button", { name: "Delivery reminders: Next page", exact: true })
                        .click();
                    const deliveryDownload = page.waitForEvent("download");
                    await page
                        .getByRole("button", { name: "Export delivery follow-up", exact: true })
                        .click();
                    assert.equal(
                        fs.readFileSync(await (await deliveryDownload).path(), "utf8").split("\r\n")
                            .length,
                        101,
                    );
                    await page
                        .getByLabel("Delivery supplier", { exact: true })
                        .selectOption("sample-supplier-1");
                    assert.equal(await page.locator(".delivery-reminders tbody tr").count(), 1);
                    assert.equal(
                        await page
                            .getByRole("button", {
                                name: "Delivery reminders: Previous page",
                                exact: true,
                            })
                            .isDisabled(),
                        true,
                    );
                    await page.getByLabel("Delivery supplier", { exact: true }).selectOption("all");
                    await page
                        .getByLabel("Delivery view", { exact: true })
                        .selectOption("No date set");
                    assert.equal(
                        await page
                            .getByRole("button", {
                                name: "Delivery reminders: Previous page",
                                exact: true,
                            })
                            .isDisabled(),
                        true,
                    );
                    await inspect(width + "-delivery-reminders");
                    await page.locator(".delivery-reminders>summary").click();
                }
                if (tab === "Overview")
                    assert.equal(await page.locator(".channels-card").isVisible(), true);
                if (tab === "Expenses") {
                    await page.getByRole("button", { name: "New expense", exact: true }).click();
                    await inspect(width + "-expense-modal");
                    await page.keyboard.press("Escape");
                }
                if (tab === "Inventory") {
                    const table = page.locator(".inventory-card .table-scroll");
                    const scroll = await table.evaluate((el) => {
                        el.scrollLeft = 200;
                        return el.scrollLeft;
                    });
                    if (width < 400)
                        assert.ok(scroll > 0, "Inventory columns remain accessible by swiping");
                }
            }
            await navigate("Inventory");
            if (
                !(await page
                    .getByRole("button", { name: "Close inventory importer", exact: true })
                    .count())
            )
                await page
                    .getByRole("button", { name: "Import inventory CSV", exact: true })
                    .click();
            await inspect(width + "-inventory-import");
            await page.getByRole("button", { name: "Add product", exact: true }).click();
            await inspect(width + "-product-form");
            await page
                .getByRole("button", { name: "Cancel", exact: true })
                .scrollIntoViewIfNeeded();
            await page.getByRole("button", { name: "Cancel", exact: true }).click();
            await navigate("Orders");
            if (!(await page.getByRole("button", { name: "Close importer", exact: true }).count()))
                await page.getByRole("button", { name: "Import orders CSV", exact: true }).click();
            await inspect(width + "-order-import");
        }
        await page.setViewportSize({ width: 390, height: 844 });
        await navigate("Suppliers");
        await page.locator(".purchase-record > summary").first().click();
        confirmationResponse = respondToConfirmation(page, true);
        await page.getByRole("button", { name: "Cancel purchase", exact: true }).click();
        await confirmationResponse;
        await page
            .locator(".purchase-record")
            .first()
            .locator(".purchase-payments>summary")
            .click();
        await page.locator(".supplier-refunds>summary").first().click();
        await page.getByRole("button", { name: "Record supplier refund", exact: true }).click();
        await page.getByLabel("Supplier refund amount", { exact: true }).fill("1");
        await inspect("390-supplier-refund");
        await page
            .getByRole("button", { name: "Close supplier refund entry", exact: true })
            .click();
        await page.setViewportSize({ width: 390, height: 844 });
        await navigate("Overview");
        await page.getByRole("button", { name: "Show sidebar", exact: true }).click();
        await page.getByRole("button", { name: "Switch to dark theme", exact: true }).click();
        await page.locator(".sidebar-close").click();
        await inspect("390-dark-overview");
        await quick("Supplier refund");
        await page.getByRole("dialog", { name: "Record supplier refund", exact: true }).waitFor();
        await page
            .getByLabel("Purchase for financial entry", { exact: true })
            .selectOption({ index: 1 });
        await page.getByLabel("Supplier refund amount", { exact: true }).fill("1");
        await inspect("390-quick-supplier-refund");
        confirmationResponse = respondToConfirmation(page, true);
        await page.getByRole("button", { name: "Save supplier refund", exact: true }).click();
        await confirmationResponse;
        await page
            .getByRole("dialog", { name: "Record supplier refund", exact: true })
            .waitFor({ state: "hidden" });
        assert.equal(await page.locator(".shell").evaluate((el) => el.inert), false);

        await quick("New expense");
        await inspect("390-dark-expense-modal");
        await page.keyboard.press("Escape");
        await page.getByRole("button", { name: "Show sidebar", exact: true }).click();
        await page
            .getByRole("button", { name: "Open account and sync settings", exact: true })
            .click();
        for (const tab of ["Profile", "Branding", "Notebook"]) {
            await page.getByRole("tab", { name: tab, exact: true }).click();
            await inspect("390-settings-" + tab);
        }
        await page.getByRole("button", { name: "Close account", exact: true }).click();
        await page.locator(".sidebar-close").click();
        const overflow = results.filter((r) => r.scroll > r.width + 1);
        assert.deepEqual(overflow, [], "Page must not overflow horizontally");
        console.log(
            "PASS All six notebook tabs, supplier editor, importers, dialogs, dark theme, and tax calculator fit phone/tablet widths",
        );
    } catch (e) {
        failure = e;
        console.error("FAIL", String(e.message || e).split("\n")[0]);
    } finally {
        if (userId) {
            const { neon } = require("@neondatabase/serverless");
            const sql = neon(process.env.DATABASE_URL);
            await sql`DELETE FROM seller_notebooks WHERE owner_id=${userId}`;
            const cli = path.join(process.env.APPDATA, "npm/node_modules/neon/dist/cli.js");
            await promisify(require("node:child_process").execFile)(
                process.execPath,
                [cli, "neon-auth", "user", "delete", userId],
                { windowsHide: true },
            );
        }
        await browser?.close();
        fs.writeFileSync(
            path.join(output, "results.json"),
            JSON.stringify(
                {
                    passed: !failure,
                    results,
                    failure: failure ? String(failure.message).split("\n")[0] : undefined,
                },
                null,
                2,
            ),
        );
    }
    process.exitCode = failure ? 1 : 0;
})();
