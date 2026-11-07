import test from "node:test";
import assert from "node:assert/strict";
import {
    addPurchasePayment,
    purchasePaymentSummary,
    addSupplierRefund,
    validSupplierRefunds,
    removePurchasePayment,
    purchasePaymentProgress,
} from "../lib/purchase-payments.mjs";
import { createSampleNotebook } from "../lib/sample-notebook.mjs";
import { createPurchase, receivePurchase } from "../lib/purchases.mjs";
import { createNotebookBackup, readNotebookBackup } from "../lib/notebook-backup.mjs";
import { purchaseCopyHtml } from "../lib/purchase-copy.mjs";
const sample = createSampleNotebook("2026-11-05"),
    supplier = sample.suppliers[0],
    id = supplier.productIds[0];
const details = {
    amount: 200,
    date: "2026-11-05",
    method: "Bank transfer",
    reference: "PRIVATE REFUND REF",
    notes: "PRIVATE REFUND NOTE",
};
function cancelled() {
    const po = createPurchase(
            supplier,
            [{ productId: id, quantity: 5, unitCost: 100 }],
            sample.products,
        ),
        paid = addPurchasePayment(po, details, "2026-11-06"),
        part = receivePurchase(paid, sample.products, [], { [id]: 1 });
    return { ...part.order, status: "Cancelled", cancelledAt: new Date().toISOString() };
}
test("received refunds reduce credit and retain gross payments, stock counters, and private backup history", () => {
    const order = cancelled(),
        refunded = addSupplierRefund(order, { ...details, amount: 40 }, "2026-11-06");
    assert.equal(purchasePaymentSummary(order).credit, 100);
    const summary = purchasePaymentSummary(refunded);
    assert.equal(summary.credit, 60);
    assert.equal(summary.paid, 200);
    assert.equal(summary.refunded, 40);
    assert.equal(summary.netPaid, 160);
    assert.equal(summary.balance, 0);
    assert.equal(refunded.items[0].receivedQuantity, 1);
    assert.deepEqual(refunded.payments, order.payments);
    const done = addSupplierRefund(refunded, { ...details, amount: 60 }, "2026-11-06");
    assert.equal(purchasePaymentSummary(done).credit, 0);
    assert.throws(() => addSupplierRefund(done, { ...details, amount: 0.01 }, "2026-11-06"));
    assert.deepEqual(
        readNotebookBackup(createNotebookBackup({ ...sample, purchaseOrders: [refunded] })).document
            .purchaseOrders,
        [refunded],
    );
    assert.doesNotMatch(purchaseCopyHtml(refunded, null), /PRIVATE REFUND REF|PRIVATE REFUND NOTE/);
});
test("refunds require cancelled credit, valid money/dates/methods, and money already paid by that date", () => {
    const order = cancelled();
    for (const patch of [
        { amount: 0 },
        { amount: -1 },
        { amount: 1.001 },
        { amount: 101 },
        { date: "2026-11-04" },
        { date: "2099-01-01" },
        { method: "unknown" },
    ])
        assert.throws(() => addSupplierRefund(order, { ...details, ...patch }, "2026-11-06"));
    assert.throws(() =>
        addSupplierRefund(
            { ...order, status: "Partially received" },
            { ...details, amount: 10 },
            "2026-11-06",
        ),
    );
    const late = {
        ...order,
        items: order.items.map((item) => ({ ...item, receivedQuantity: 0 })),
        payments: [
            { ...order.payments[0], amount: 10 },
            { ...order.payments[0], id: "later", amount: 190, date: "2026-11-06" },
        ],
    };
    assert.throws(() => addSupplierRefund(late, { ...details, amount: 20 }, "2026-11-06"));
    assert.equal(validSupplierRefunds({ ...order, supplierRefunds: null }, "2026-11-06"), false);
});
test("payment corrections cannot orphan refunds, while removing a mistaken refund restores review credit", () => {
    const order = cancelled(),
        refunded = addSupplierRefund(order, { ...details, amount: 50 }, "2026-11-06");
    assert.throws(() => removePurchasePayment(refunded, refunded.payments[0].id));
    const corrected = { ...refunded, supplierRefunds: [] };
    assert.equal(purchasePaymentSummary(corrected).credit, 100);
    assert.doesNotThrow(() => removePurchasePayment(corrected, corrected.payments[0].id));
    assert.notEqual(purchasePaymentProgress(refunded), purchasePaymentProgress(corrected));
    const duplicate = {
        ...refunded,
        supplierRefunds: [refunded.supplierRefunds[0], refunded.supplierRefunds[0]],
    };
    assert.equal(validSupplierRefunds(duplicate, "2026-11-06"), false);
});
