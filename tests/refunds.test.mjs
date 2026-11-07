import test from "node:test";
import assert from "node:assert/strict";
import { createRefund, refundTotal } from "../lib/refunds.mjs";
import { profitSummary } from "../lib/expenses.mjs";
import { validDocument } from "../lib/notebook-validation.mjs";
import { customerOrderHtml, customerOrderSummary } from "../lib/order-copy.mjs";
import { createNotebookBackup, readNotebookBackup } from "../lib/notebook-backup.mjs";
const product = {
    id: "p1",
    sku: "MUG",
    name: "Mug",
    category: "Home",
    cost: 100,
    price: 300,
    stock: 9,
    color: "#eeeeee",
    symbol: "☕",
};
const order = {
    id: "o1",
    productId: "p1",
    productName: "Mug",
    customer: "Ana",
    channel: "Direct",
    quantity: 1,
    price: 300,
    cost: 100,
    fee: 0,
    packaging: 10,
    shipping: 0,
    date: "2026-11-04",
    status: "Completed",
};
const input = { orderId: "o1", amount: 100, date: "2026-11-05", reason: "Partial refund" };
test("partial and full refunds use cents and cannot exceed the recorded item value", () => {
    const first = createRefund([order], [], input, "2026-11-05");
    const second = createRefund([order], [first], { ...input, amount: 200 }, "2026-11-05");
    assert.equal(refundTotal([first, second]), 300);
    assert.throws(() =>
        createRefund([order], [first, second], { ...input, amount: 0.01 }, "2026-11-05"),
    );
    for (const bad of [
        { ...input, amount: 0 },
        { ...input, amount: 1.001 },
        { ...input, date: "2026-11-03" },
        { ...input, date: "2026-11-06" },
        { ...input, reason: " " },
    ])
        assert.throws(() => createRefund([order], [], bad, "2026-11-05"));
    assert.throws(() =>
        createRefund([{ ...order, status: "Processing" }], [], input, "2026-11-05"),
    );
});
test("refunds reduce net profit while retaining original costs and stock", () => {
    const refund = createRefund([order], [], input, "2026-11-05");
    const summary = profitSummary([order], [], [refund]);
    assert.equal(summary.revenue, 300);
    assert.equal(summary.orderCosts, 110);
    assert.equal(summary.netProfit, 90);
    assert.equal(product.stock, 9);
    assert.equal(profitSummary([], [], [refund]).netProfit, -100);
});
test("snapshot validation rejects duplicate IDs, over-refunds, and refunds on non-completed orders", () => {
    const refund = createRefund([order], [], input, "2026-11-05");
    const document = { products: [product], orders: [order], refundRecords: [refund] };
    assert.equal(validDocument(document), true);
    for (const refundRecords of [
        [refund, refund],
        [{ ...refund, amount: 301 }],
        [{ ...refund, date: "2026-02-30" }],
    ])
        assert.equal(validDocument({ ...document, refundRecords }), false);
    assert.equal(
        validDocument({ ...document, orders: [{ ...order, status: "Cancelled" }] }),
        false,
    );
});
test("customer copies show refund totals without private reasons and backups preserve records", () => {
    const refund = createRefund(
        [order],
        [],
        { ...input, reason: "Private internal reason" },
        "2026-11-05",
    );
    const summary = customerOrderSummary([order], null, [refund]);
    assert.equal(summary.refunded, 100);
    const html = customerOrderHtml([order], null, [refund]);
    assert.ok(html.includes("Recorded refunds:"));
    assert.ok(!html.includes("Private internal reason"));
    const backup = readNotebookBackup(
        createNotebookBackup({ products: [product], orders: [order], refundRecords: [refund] }),
    );
    assert.equal(backup.document.refundRecords[0].amount, 100);
});
