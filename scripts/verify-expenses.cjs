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
            await p.getByLabel("Your name").fill("Paged expenses review");
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
        const user = await signup(context, "notebook-expenses"),
            { createSampleNotebook } = await import("../lib/sample-notebook.mjs"),
            { reportRange, inReportRange } = await import("../lib/reporting.mjs");
        const document = createSampleNotebook(),
            today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(
                new Date(),
            ),
            tomorrow = new Date(Date.parse(today + "T12:00:00Z") + 86400000)
                .toISOString()
                .slice(0, 10);
        document.expenses.push(
            {
                id: "expense-tie-last",
                title: "Literal search fixture",
                category: "Other",
                amount: 0.1,
                date: today,
                channel: "Business",
                notes: "Literal %_ note",
            },
            {
                id: "expense-tie-first",
                title: "Same date second fixture",
                category: "Software",
                amount: 0.29,
                date: today,
                channel: "Direct",
                notes: "Case-sensitive-looking NOTE",
            },
            {
                id: "expense-tie-middle",
                title: "Same date third fixture",
                category: "Other",
                amount: 2.31,
                date: today,
                channel: "Shopee",
                notes: "",
            },
            {
                id: "expense-future",
                title: "Future expense fixture",
                category: "Other",
                amount: 999,
                date: tomorrow,
                channel: "Business",
                notes: "Excluded from reports until its date",
            },
        );
        const seeded = await context.request.put(base + "/api/notebook", {
            headers: { Origin: base },
            data: { revision: 0, document },
        });
        assert.equal(seeded.status(), 200, await seeded.text());
        let revision = (await seeded.json()).revision,
            cases = 0;
        for (const period of ["all", "7", "custom"])
            for (const channel of ["All channels", "Shopee", "Direct"])
                for (const category of ["All categories", "Software", "Other"])
                    for (const search of ["", "fictional"]) {
                        const from = today.slice(0, 7) + "-01",
                            to = today,
                            range = reportRange(
                                period,
                                today,
                                [
                                    ...document.orders,
                                    ...document.expenses,
                                    ...document.refundRecords,
                                ].map((row) => row.date),
                                from,
                                to,
                            ),
                            expected = document.expenses
                                .filter(
                                    (e) =>
                                        inReportRange(e.date, range) &&
                                        (channel === "All channels" || e.channel === channel) &&
                                        (category === "All categories" ||
                                            e.category === category) &&
                                        (e.title + " " + e.notes).toLowerCase().includes(search),
                                )
                                .toSorted((a, b) => b.date.localeCompare(a.date));
                        const response = await context.request.get(
                            base +
                                "/api/notebook/expenses?" +
                                new URLSearchParams({
                                    revision: String(revision),
                                    period,
                                    channel,
                                    category,
                                    search,
                                    from,
                                    to,
                                    page: "2",
                                    size: "10",
                                }),
                        );
                        assert.equal(response.status(), 200, await response.text());
                        const body = await response.json(),
                            actualPage = Math.min(2, Math.max(1, Math.ceil(expected.length / 10)));
                        assert.equal(body.total, expected.length);
                        assert.equal(
                            body.totalAmount,
                            expected.reduce((sum, e) => sum + Math.round(e.amount * 100), 0) / 100,
                        );
                        assert.equal(body.page, actualPage);
                        assert.deepEqual(
                            body.items.map((row) => row.id),
                            expected
                                .slice((actualPage - 1) * 10, actualPage * 10)
                                .map((row) => row.id),
                        );
                        cases++;
                    }
        const literal = await (
            await context.request.get(
                base +
                    "/api/notebook/expenses?" +
                    new URLSearchParams({
                        revision: String(revision),
                        period: "all",
                        search: "%_",
                    }),
            )
        ).json();
        assert.deepEqual(
            literal.items.map((row) => row.id),
            ["expense-tie-last"],
        );
        pass(
            `SQL expense pages match ${cases} period/channel/category/search combinations, exact cent totals, stable date ties and literal wildcard searches`,
        );
        const page = await context.newPage(),
            reads = [];
        page.on("request", (request) => {
            if (
                request.method() === "GET" &&
                new URL(request.url()).pathname.startsWith("/api/notebook")
            )
                reads.push(request.url());
        });
        await page.goto(base + "/notebook");
        await page.getByText("Live across your devices", { exact: true }).waitFor();
        await page
            .locator("#notebook-sidebar nav")
            .getByRole("button", { name: /^Expenses/ })
            .click();
        await page.getByLabel("Date range", { exact: true }).selectOption("all");
        await page
            .locator(".expense-list .pagination")
            .getByText("Page 1 of 5", { exact: true })
            .waitFor();
        assert.equal(await page.locator(".expense-list tbody tr").count(), 25);
        assert.ok(!reads.some((url) => url.includes("/pages?")));
        await page.getByRole("button", { name: "Expenses: Next page", exact: true }).click();
        await page
            .locator(".expense-list .pagination")
            .getByText("Page 2 of 5", { exact: true })
            .waitFor();
        await page.getByLabel("Search expenses", { exact: true }).fill("%_");
        await page
            .locator(".expense-list tbody")
            .getByText("Literal search fixture", { exact: true })
            .waitFor();
        assert.equal(await page.locator(".expense-list tbody tr").count(), 1);
        await page.getByLabel("Search expenses", { exact: true }).fill("");
        await page
            .locator(".expense-list .pagination")
            .getByText("Page 1 of 5", { exact: true })
            .waitFor();
        await page.getByLabel("Filter expense category", { exact: true }).selectOption("Software");
        await page
            .locator(".expense-list .pagination")
            .getByText("Page 1 of 1", { exact: true })
            .waitFor();
        const download = page.waitForEvent("download");
        await page.getByRole("button", { name: "Export expenses", exact: true }).click();
        assert.equal(
            fs.readFileSync(await (await download).path(), "utf8").split("\r\n").length,
            document.expenses.filter((e) => e.date <= today && e.category === "Software").length +
                1,
        );
        await page
            .getByLabel("Filter expense category", { exact: true })
            .selectOption("All categories");
        await page
            .locator(".expense-list .pagination")
            .getByText("Page 1 of 5", { exact: true })
            .waitFor();
        for (const width of [320, 390, 768]) {
            await page.setViewportSize({ width, height: 844 });
            await page.waitForFunction((width) => innerWidth === width, width);
            assert.ok(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            );
            fs.mkdirSync("verification/mobile", { recursive: true });
            await page.screenshot({ path: `verification/mobile/cloud-expenses-${width}.png` });
        }
        await page.setViewportSize({ width: 1440, height: 1000 });
        assert.ok(!reads.some((url) => url.includes("/pages?")));
        pass(
            "Expense browsing, category/search resets, totals and complete exports need no collection hydration and fit phone/tablet widths",
        );
        const target = document.expenses
                .filter((expense) => expense.date <= today)
                .toSorted((a, b) => b.date.localeCompare(a.date))[0],
            changed = { ...target, title: "Live expense revised", amount: target.amount + 0.01 };
        const live = await context.request.patch(base + "/api/notebook", {
            headers: { Origin: base },
            data: {
                revision,
                changes: {
                    expenses: {
                        remove: [],
                        upsert: [
                            {
                                index: document.expenses.findIndex((e) => e.id === target.id),
                                record: changed,
                            },
                        ],
                    },
                },
            },
        });
        assert.equal(live.status(), 200, await live.text());
        revision = (await live.json()).revision;
        await page
            .locator(".expense-list tbody")
            .getByText(changed.title, { exact: true })
            .waitFor();
        assert.ok(!reads.some((url) => url.includes("/pages?")));
        pass("Live expense changes refresh only the visible expense page before a tool is opened");
        await page.getByRole("button", { name: "Delete " + changed.title, exact: true }).click();
        const dialog = page.getByRole("dialog", { name: "Please confirm", exact: true });
        await dialog.waitFor();
        const unseen = {
            ...document.expenses.find((expense) => expense.id === "expense-future"),
            notes: "Unseen expense changed during confirmation",
        };
        const note = await context.request.patch(base + "/api/notebook", {
            headers: { Origin: base },
            data: {
                revision,
                changes: {
                    expenses: {
                        remove: [],
                        upsert: [
                            {
                                index: document.expenses.findIndex(
                                    (expense) => expense.id === unseen.id,
                                ),
                                record: unseen,
                            },
                        ],
                    },
                },
            },
        });
        assert.equal(note.status(), 200, await note.text());
        revision = (await note.json()).revision;
        await page.waitForFunction(() =>
            [...document.querySelectorAll("[role=dialog] button")].some(
                (button) => button.textContent === "Continue" && button.disabled,
            ),
        );
        await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
        assert.ok(!reads.some((url) => url.includes("/pages?")));
        await page.getByRole("button", { name: "Delete " + changed.title, exact: true }).click();
        await dialog.waitFor();
        const removed = page.waitForResponse(
            (response) =>
                response.url().endsWith("/api/notebook/record") &&
                response.request().method() === "POST",
        );
        await dialog.getByRole("button", { name: "Continue", exact: true }).click();
        const response = await removed;
        assert.equal(response.status(), 200, await response.text());
        const payload = response.request().postDataJSON();
        assert.equal(payload.collection, "expenses");
        assert.equal(payload.id, target.id);
        assert.equal(payload.record, null);
        assert.deepEqual(payload.expected, changed);
        let after = await (await context.request.get(base + "/api/notebook")).json();
        revision = after.revision;
        assert.equal(after.document.expenses.length, document.expenses.length - 1);
        assert.ok(!after.document.expenses.some((e) => e.id === target.id));
        assert.deepEqual(after.document.products, document.products);
        assert.deepEqual(after.document.orders, document.orders);
        assert.equal(
            after.document.expenses.find((expense) => expense.id === "expense-future").notes,
            unseen.notes,
        );
        assert.ok(!reads.some((url) => url.includes("/pages?")));
        pass(
            "Unloaded revisions invalidate delete confirmation; targeted deletion removes only its expense without collection hydration",
        );
        const editTarget = after.document.expenses
            .filter((e) => e.date <= today)
            .toSorted((a, b) => b.date.localeCompare(a.date))[0];
        await page.getByRole("button", { name: "Edit " + editTarget.title, exact: true }).click();
        await page.getByRole("dialog", { name: "Edit expense", exact: true }).waitFor();
        const newer = { ...editTarget, amount: editTarget.amount + 1 };
        const remote = await context.request.patch(base + "/api/notebook", {
            headers: { Origin: base },
            data: {
                revision,
                changes: {
                    expenses: {
                        remove: [],
                        upsert: [
                            {
                                index: after.document.expenses.findIndex(
                                    (e) => e.id === editTarget.id,
                                ),
                                record: newer,
                            },
                        ],
                    },
                },
            },
        });
        assert.equal(remote.status(), 200, await remote.text());
        revision = (await remote.json()).revision;
        await page.waitForFunction(
            (amount) =>
                [...document.querySelectorAll(".expense-list tbody tr")].some((row) =>
                    row.textContent.includes(amount),
                ),
            new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
                newer.amount,
            ),
        );
        await page.getByRole("button", { name: "Save expense", exact: true }).click();
        await page
            .getByText(
                "This expense changed or was removed on another device. Cancel this edit and reopen the latest entry.",
                { exact: true },
            )
            .waitFor();
        await page.getByRole("button", { name: "Cancel edit", exact: true }).click();
        after = await (await context.request.get(base + "/api/notebook")).json();
        assert.equal(
            after.document.expenses.find((e) => e.id === editTarget.id).amount,
            newer.amount,
        );
        pass("Expense editor survives live page refresh and rejects stale saves");
        assert.equal(
            (await context.request.get(base + "/api/notebook/expenses?revision=0")).status(),
            409,
        );
        for (const query of ["category=Invalid", "size=101", "channel=Business"])
            assert.equal(
                (
                    await context.request.get(
                        base + "/api/notebook/expenses?revision=" + revision + "&" + query,
                    )
                ).status(),
                400,
            );
        const other = await browser.newContext();
        await signup(other, "notebook-expenses-other");
        const empty = await (
            await other.request.get(base + "/api/notebook/expenses?revision=0&period=all")
        ).json();
        assert.equal(empty.total, 0);
        assert.equal(empty.totalAmount, 0);
        assert.deepEqual(empty.items, []);
        assert.equal(
            (
                await other.request.get(base + "/api/notebook/expenses?revision=" + revision, {
                    headers: { "X-Notebook-User": user.id },
                })
            ).status(),
            401,
        );
        await other.close();
        const anon = await browser.newContext();
        assert.equal(
            (await anon.request.get(base + "/api/notebook/expenses?revision=0")).status(),
            401,
        );
        await anon.close();
        pass("Expense page bounds, filters, revisions and real-account isolation are enforced");
    } catch (error) {
        failure = error;
        console.error("FAIL", String(error.message || error).split("\n")[0]);
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
            "verification/expenses-e2e.json",
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
