import test from "node:test";
import assert from "node:assert/strict";
import { parseNotebookView, viewKinds } from "../lib/notebook-view-query.mjs";
import { notebookViewExport } from "../lib/notebook-view-export.mjs";
import { createSampleNotebook } from "../lib/sample-notebook.mjs";
import { eligibleFinancialPurchases } from "../lib/purchase-payments.mjs";
const filters = (kind, extra = {}) =>
    parseNotebookView(new URLSearchParams({ kind, revision: "4", ...extra }), "2026-11-06");
test("view queries constrain kinds, bounds, statuses and identities; preserve purchase search and trim statement search", () => {
    for (const kind of viewKinds) assert.equal(filters(kind).kind, kind);
    assert.equal(filters("purchases", { search: " test " }).search, " test ");
    assert.equal(filters("statements", { search: " test " }).search, "test");
    for (const values of [
        { kind: "unknown" },
        { size: "101" },
        { page: "10001" },
        { revision: "-1" },
        { status: "bad" },
        { parent: "x".repeat(101) },
        { search: "x".repeat(201) },
    ])
        assert.throws(() => filters("purchases", values));
    assert.throws(() => parseNotebookView(new URLSearchParams("kind=stock")));
});
test("full statement exports preserve every matching purchase and omit private transactions and maker footer", () => {
    const document = createSampleNotebook("2026-11-06");
    document.purchaseOrders[0].payments[0].notes = "SECRET-NOTE";
    document.purchaseOrders[0].payments[0].reference = "SECRET-REFERENCE";
    const csv = notebookViewExport(document, filters("statements")).body,
        html = notebookViewExport(document, filters("statements"), "html").body;
    assert.equal(csv.split("\r\n").length, 101);
    assert.ok(html.includes("SAMPLE-PO-100"));
    for (const text of [csv, html])
        for (const privateText of ["SECRET-NOTE", "SECRET-REFERENCE", "ajmission.dev"])
            assert.ok(!text.includes(privateText));
    assert.throws(() => notebookViewExport(document, filters("stock"), "html"));
});
test("complete histories scope by purchase/product/order group and escape spreadsheet formulas", () => {
    const document = createSampleNotebook("2026-11-06"),
        po = document.purchaseOrders[0],
        stock = document.stockAdjustments[0];
    stock.reason = " =SUM(1,2)";
    assert.equal(notebookViewExport(document, filters("stock")).body.split("\r\n").length, 121);
    assert.ok(
        notebookViewExport(document, filters("stock", { parent: stock.productId })).body.includes(
            "' =SUM(1,2)",
        ),
    );
    assert.equal(
        notebookViewExport(document, filters("payments", { parent: po.id })).body.split("\r\n")
            .length,
        po.payments.length + 1,
    );
    assert.equal(
        notebookViewExport(document, filters("payments", { parent: "missing" })).body.split("\r\n")
            .length,
        1,
    );
    assert.equal(
        notebookViewExport(document, filters("refunds", { parent: "missing" })).body.split("\r\n")
            .length,
        1,
    );
});
test("financial picker filters are constrained and complete exports use the same eligibility rules", () => {
    const document = createSampleNotebook();
    for (const financial of ["payment", "supplier-refund"]) {
        const query = filters("statements", { financial });
        assert.equal(query.financial, financial);
        assert.equal(
            notebookViewExport(document, query).body.split("\r\n").length,
            eligibleFinancialPurchases(document.purchaseOrders, financial).length + 1,
        );
    }
    assert.throws(() => filters("statements", { financial: "unknown" }));
    assert.throws(() => filters("purchases", { financial: "payment" }));
});
