import test from "node:test";
import assert from "node:assert/strict";
import {
    purchaseCopySummary,
    purchaseCopyHtml,
    purchaseOverview,
    isPurchaseOverdue,
} from "../lib/purchase-copy.mjs";
const order = {
    id: "po1",
    reference: "PO-ONE",
    supplierId: "s1",
    supplierName: "Supply studio",
    createdAt: "2026-11-04T18:00:00Z",
    expectedDate: "2026-11-05",
    notes: "Private supplier negotiation",
    status: "Partially received",
    items: [
        {
            productId: "p1",
            productName: "Notebook",
            sku: "NB-1",
            quantity: 5,
            receivedQuantity: 2,
            unitCost: 10.25,
        },
    ],
};
test("supplier copies reconcile original and outstanding totals, keep internal notes private, and omit maker credit", () => {
    const summary = purchaseCopySummary(order, {
        businessName: "Little shop",
        tagline: "On paper",
    });
    assert.equal(summary.total, 51.25);
    assert.equal(summary.outstandingTotal, 30.75);
    assert.equal(summary.date, "2026-11-05");
    const html = purchaseCopyHtml(order, { businessName: "Little shop", tagline: "On paper" });
    assert.match(html, /Little shop/);
    assert.match(html, /Supply studio/);
    assert.match(html, /NB-1/);
    assert.doesNotMatch(html, /Private supplier negotiation|ajmission|Made with|<footer|<script/i);
});
test("cancelled remainder is shown without an outstanding balance; legacy received copies remain fully received", () => {
    const cancelled = purchaseCopySummary({ ...order, status: "Cancelled" }, null);
    assert.equal(cancelled.items[0].cancelled, 3);
    assert.equal(cancelled.outstandingTotal, 0);
    assert.equal(cancelled.items[0].received, 2);
    const legacy = purchaseCopySummary(
        {
            ...order,
            status: "Received",
            items: order.items.map(({ receivedQuantity, ...item }) => item),
        },
        null,
    );
    assert.equal(legacy.items[0].received, 5);
    assert.equal(legacy.outstandingTotal, 0);
});
test("all untrusted copy text is escaped and no external resources are required", () => {
    const html = purchaseCopyHtml(
        {
            ...order,
            reference: "<img src=x>",
            supplierName: "<script>alert(1)</script>",
            items: [{ ...order.items[0], productName: "<svg onload=alert(1)>", sku: "A&B" }],
        },
        { businessName: "<b>Shop</b>", tagline: '"<hello>' },
    );
    assert.match(html, /&lt;script&gt;/);
    assert.match(html, /A&amp;B/);
    assert.doesNotMatch(html, /<script|<img|<svg|<link|<iframe/i);
});
test("overdue and outstanding summaries count open purchases once and ignore closed balances", () => {
    const today = "2026-11-06",
        dueToday = { ...order, id: "today", expectedDate: today },
        noDate = { ...order, id: "no-date", expectedDate: "" };
    const cancelled = { ...order, id: "cancelled", status: "Cancelled" },
        received = { ...order, id: "received", status: "Received" };
    assert.equal(isPurchaseOverdue(order, today), true);
    for (const item of [dueToday, noDate, cancelled, received])
        assert.equal(isPurchaseOverdue(item, today), false);
    assert.deepEqual(purchaseOverview([order, dueToday, noDate, cancelled, received], today), {
        openCount: 3,
        overdueCount: 1,
        outstandingUnits: 9,
        outstandingCost: 92.25,
    });
    assert.deepEqual(purchaseOverview([], today), {
        openCount: 0,
        overdueCount: 0,
        outstandingUnits: 0,
        outstandingCost: 0,
    });
});
