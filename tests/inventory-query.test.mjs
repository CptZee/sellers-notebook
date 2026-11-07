import test from "node:test";
import assert from "node:assert/strict";
import { parseInventoryQuery } from "../lib/inventory-query.mjs";
import { notebookExport } from "../lib/notebook-export.mjs";
import { createSampleNotebook } from "../lib/sample-notebook.mjs";
test("inventory queries bound page sizes, revisions and search without wildcard interpretation", () => {
    assert.deepEqual(
        parseInventoryQuery(new URLSearchParams("revision=2&page=3&size=50&search=%25_")),
        { revision: 2, page: 3, size: 50, search: "%_" },
    );
    for (const query of [
        "revision=-1",
        "revision=1&page=0",
        "revision=1&size=101",
        "revision=1&size=1",
        "page=1",
        "revision=1&page=10001",
        "revision=1&search=" + "x".repeat(201),
    ])
        assert.throws(() => parseInventoryQuery(new URLSearchParams(query)));
});
test("server exports include every matching record and safely quote formula-like names", () => {
    const document = createSampleNotebook("2026-11-06"),
        copy = structuredClone(document);
    document.products[0].name = " =FORMULA()";
    document.products[0].sku = 'SKU,"quoted"';
    const all = notebookExport(document, new URLSearchParams("kind=inventory"), "2026-11-06");
    assert.equal(all.csv.split("\r\n").length, 121);
    assert.ok(all.csv.includes('"\' =FORMULA()"'));
    assert.ok(all.csv.includes('"SKU,""quoted"""'));
    assert.equal(
        notebookExport(
            document,
            new URLSearchParams("kind=inventory&search=SKU%2C"),
            "2026-11-06",
        ).csv.split("\r\n").length,
        2,
    );
    const orders = notebookExport(
        document,
        new URLSearchParams("kind=orders&period=all&status=Completed&channel=Shopee"),
        "2026-11-06",
    );
    assert.ok(orders.csv.includes("Completed"));
    assert.ok(!orders.csv.includes("Processing"));
    assert.ok(!orders.csv.includes("Lazada"));
    const expenses = notebookExport(
        document,
        new URLSearchParams("kind=expenses&period=all&category=Software"),
        "2026-11-06",
    );
    assert.equal(expenses.csv.split("\r\n").length, 21);
    assert.deepEqual(document.orders, copy.orders);
    assert.deepEqual(document.expenses, copy.expenses);
    assert.throws(() =>
        notebookExport(document, new URLSearchParams("kind=unknown"), "2026-11-06"),
    );
    assert.throws(() =>
        notebookExport(
            document,
            new URLSearchParams("kind=expenses&category=invalid"),
            "2026-11-06",
        ),
    );
});
