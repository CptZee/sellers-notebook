import test from "node:test";
import assert from "node:assert/strict";
import {
    goodsReturn,
    voidGoodsReturn,
    returnRefundAvailable,
    addGoodsReturnRefund,
    validGoodsReturns,
} from "../lib/supplier-returns.mjs";
import { createSampleNotebook } from "../lib/sample-notebook.mjs";
import { purchaseCommand } from "../lib/purchase-command.mjs";
import { applyNotebookPatch } from "../lib/notebook-patch.mjs";
import { validDocument } from "../lib/notebook-validation.mjs";
import { removePurchasePayment, purchasePaymentSummary } from "../lib/purchase-payments.mjs";
const date = "2026-01-02";
const order = {
    id: "po",
    reference: "PO-1",
    status: "Received",
    createdAt: "2026-01-01T00:00:00Z",
    items: [
        {
            productId: "p",
            productName: "Item",
            sku: "SKU",
            quantity: 5,
            receivedQuantity: 5,
            unitCost: 100,
        },
    ],
    payments: [{ id: "paid", amount: 500, date, method: "Cash", reference: "", notes: "" }],
    supplierRefunds: [],
};
const products = [{ id: "p", name: "Item", sku: "SKU", stock: 5, cost: 250 }];
const input = { items: [{ productId: "p", quantity: 2 }], date, reason: "Damaged goods" };
test("physical return preserves gross deliveries and historical cost while reducing stock", () => {
    const result = goodsReturn(order, products, [], input, "return");
    assert.equal(result.products[0].stock, 3);
    assert.equal(result.order.items[0].receivedQuantity, 5);
    assert.equal(result.order.goodsReturns[0].items[0].unitCost, 100);
    assert.equal(returnRefundAvailable(result.order), 200);
    assert.equal(products[0].stock, 5);
    assert.ok(validGoodsReturns(result.order));
});
test("return limits reject excess units and duplicate product lines", () => {
    assert.throws(() =>
        goodsReturn(
            order,
            products,
            [],
            { ...input, items: [{ productId: "p", quantity: 6 }] },
            "r",
        ),
    );
    assert.throws(() =>
        goodsReturn(
            order,
            products,
            [],
            { ...input, items: [...input.items, ...input.items] },
            "r",
        ),
    );
    assert.throws(() => goodsReturn(order, [{ ...products[0], stock: 1 }], [], input, "r"));
});
test("unpaid goods credit cannot be recorded as cash", () => {
    const result = goodsReturn({ ...order, payments: [] }, products, [], input, "r");
    assert.equal(returnRefundAvailable(result.order), 0);
    assert.throws(() =>
        addGoodsReturnRefund(result.order, { amount: 1, date, method: "Cash" }, "cash"),
    );
});
test("cash refunds cap available credit and block voiding until corrected", () => {
    const result = goodsReturn(order, products, [], input, "r");
    const refunded = addGoodsReturnRefund(
        result.order,
        { amount: 100, date, method: "Cash" },
        "cash",
    );
    assert.equal(returnRefundAvailable(refunded), 100);
    assert.throws(() =>
        addGoodsReturnRefund(refunded, { amount: 101, date, method: "Cash" }, "cash2"),
    );
    assert.throws(() => voidGoodsReturn(refunded, result.products, result.stockAdjustments, "r"));
    const restored = voidGoodsReturn(result.order, result.products, result.stockAdjustments, "r");
    assert.equal(restored.products[0].stock, 5);
    assert.ok(validGoodsReturns(restored.order));
    assert.equal(returnRefundAvailable(restored.order), 0);
    assert.throws(() =>
        voidGoodsReturn(restored.order, restored.products, restored.stockAdjustments, "r"),
    );
});
test("commands require the reviewed purchase and retain valid stock audit links", () => {
    const doc = createSampleNotebook(),
        p = doc.products.find((p) => p.stock >= 5),
        po = {
            ...order,
            items: order.items.map((i) => ({
                ...i,
                productId: p.id,
                productName: p.name,
                sku: p.sku,
            })),
            supplierId: doc.suppliers[0].id,
            supplierName: doc.suppliers[0].name,
            notes: "",
            expectedDate: "",
            receivedAt: order.createdAt,
        };
    doc.purchaseOrders = [po];
    const command = {
        kind: "goods-return",
        id: po.id,
        expected: po,
        entryId: "return",
        input: { ...input, items: [{ productId: p.id, quantity: 2 }] },
    };
    const next = applyNotebookPatch(doc, purchaseCommand(doc, command));
    assert.ok(validDocument(next));
    assert.throws(() => purchaseCommand(next, command));
    assert.equal(
        validDocument({
            ...next,
            stockAdjustments: next.stockAdjustments.filter(
                (a) => a.id !== next.purchaseOrders[0].goodsReturns[0].items[0].stockAdjustmentId,
            ),
        }),
        false,
    );
});
test("cash entries cannot predate supporting goods and prevent removing their payment", () => {
    const r = goodsReturn(order, products, [], input, "r").order;
    assert.throws(() =>
        addGoodsReturnRefund(r, { amount: 1, date: "2026-01-01", method: "Cash" }, "cash"),
    );
    const refunded = addGoodsReturnRefund(r, { amount: 100, date, method: "Cash" }, "cash");
    assert.throws(() => removePurchasePayment(refunded, "paid"));
    const unpaid = goodsReturn({ ...order, payments: [] }, products, [], input, "r").order;
    assert.equal(purchasePaymentSummary(unpaid).balance, 300);
});
