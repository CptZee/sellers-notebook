import test from "node:test";
import assert from "node:assert/strict";
import {
    addPurchasePayment,
    purchasePaymentSummary,
    validPurchasePayments,
    purchasePaymentProgress,
    eligibleFinancialPurchases,
} from "../lib/purchase-payments.mjs";
import { purchaseCopyHtml } from "../lib/purchase-copy.mjs";
import { createNotebookBackup, readNotebookBackup } from "../lib/notebook-backup.mjs";
import { createSampleNotebook } from "../lib/sample-notebook.mjs";
import { createPurchase, receivePurchase } from "../lib/purchases.mjs";
const sample = createSampleNotebook("2026-11-05"),
    supplier = sample.suppliers[0];
const make = () =>
    createPurchase(
        supplier,
        [{ productId: supplier.productIds[0], quantity: 5, unitCost: 100 }],
        sample.products,
    );
const payment = {
    amount: 200,
    date: "2026-11-05",
    method: "Bank transfer",
    reference: "Private bank reference",
    notes: "Private payment note",
};
test("partial payments reconcile item balance with cents and preserve stock/history", () => {
    const original = make(),
        paid = addPurchasePayment(original, payment, "2026-11-06");
    assert.equal(paid.payments.length, 1);
    assert.deepEqual(original.payments, []);
    assert.deepEqual(purchasePaymentSummary(paid), {
        originalTotal: 500,
        itemTotal: 500,
        paid: 200,
        refunded: 0,
        netPaid: 200,
        balance: 300,
        credit: 0,
        recordable: 300,
    });
    const full = addPurchasePayment(paid, { ...payment, amount: 300 }, "2026-11-06");
    assert.equal(purchasePaymentSummary(full).balance, 0);
    assert.throws(() => addPurchasePayment(full, { ...payment, amount: 0.01 }, "2026-11-06"));
    const delivered = receivePurchase(paid, sample.products, [], { [supplier.productIds[0]]: 1 });
    assert.deepEqual(delivered.order.payments, paid.payments);
    const cancelled = {
        ...delivered.order,
        status: "Cancelled",
        cancelledAt: new Date().toISOString(),
    };
    assert.equal(purchasePaymentSummary(cancelled).credit, 100);
    assert.equal(purchasePaymentSummary(cancelled).balance, 0);
    assert.throws(() => addPurchasePayment(cancelled, payment, "2026-11-06"));
});
test("payment records reject invalid money, dates, methods, duplicate IDs and excessive totals", () => {
    const paid = addPurchasePayment(make(), payment, "2026-11-06"),
        record = paid.payments[0];
    for (const patch of [
        { amount: 0 },
        { amount: -1 },
        { amount: 1.001 },
        { amount: NaN },
        { amount: 501 },
        { date: "2026-02-30" },
        { date: "2099-01-01" },
        { method: "unknown" },
        { notes: "x".repeat(501) },
    ])
        assert.equal(validPurchasePayments([{ ...record, ...patch }], 50000, "2026-11-06"), false);
    assert.equal(validPurchasePayments([record, record], 50000, "2026-11-06"), false);
    assert.equal(
        validPurchasePayments(
            Array.from({ length: 101 }, (_, i) => ({ ...record, id: String(i), amount: 0.01 })),
            50000,
            "2026-11-06",
        ),
        false,
    );
    assert.equal(
        validPurchasePayments(
            [
                { ...record, amount: 0.1 },
                { ...record, id: "second", amount: 0.2 },
            ],
            30,
            "2026-11-06",
        ),
        true,
    );
});
test("payments are private in copies, included in backups, and progress ignores JSONB object key order", () => {
    const order = addPurchasePayment(make(), payment, "2026-11-06");
    const html = purchaseCopyHtml(order, null);
    assert.doesNotMatch(html, /Private bank reference|Private payment note/);
    assert.deepEqual(
        readNotebookBackup(createNotebookBackup({ ...sample, purchaseOrders: [order] })).document
            .purchaseOrders,
        [order],
    );
    const reordered = {
        ...order,
        payments: order.payments.map((p) => Object.fromEntries(Object.entries(p).reverse())),
    };
    assert.equal(purchasePaymentProgress(reordered), purchasePaymentProgress(order));
    assert.notEqual(
        purchasePaymentProgress({ ...order, payments: [] }),
        purchasePaymentProgress(order),
    );
    assert.equal(purchasePaymentSummary(make()).paid, 0);
});

test("floating financial shortcuts list only purchases with recordable balances or refund credit", () => {
    const open = make(),
        paid = addPurchasePayment(open, { ...payment, amount: 500 }, "2026-11-06"),
        cancelled = {
            ...addPurchasePayment(make(), payment, "2026-11-06"),
            status: "Cancelled",
            cancelledAt: new Date().toISOString(),
        };
    assert.deepEqual(eligibleFinancialPurchases([open, paid, cancelled], "payment"), [open]);
    assert.deepEqual(eligibleFinancialPurchases([open, paid, cancelled], "supplier-refund"), [
        cancelled,
    ]);
});
