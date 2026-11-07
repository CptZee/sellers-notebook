import test from "node:test";
import assert from "node:assert/strict";
import { createPurchase, receivePurchase, validPurchaseOrders } from "../lib/purchases.mjs";
import { createSampleNotebook } from "../lib/sample-notebook.mjs";
import { createNotebookBackup, readNotebookBackup } from "../lib/notebook-backup.mjs";
const sample = createSampleNotebook("2026-11-05"),
    supplier = sample.suppliers[0],
    products = sample.products;
const lines = [{ productId: supplier.productIds[0], quantity: 5, unitCost: 100 }];
test("receiving a purchase adds units/history once and preserves costs and unrelated stock", () => {
    const order = createPurchase(supplier, lines, products),
        before = structuredClone(products),
        result = receivePurchase(order, products, []);
    assert.ok(
        order.reference.startsWith(
            "PO-" +
                new Date(order.createdAt).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }) +
                "-",
        ),
    );
    assert.equal(result.order.status, "Received");
    assert.equal(
        result.products.find((p) => p.id === lines[0].productId).stock,
        products.find((p) => p.id === lines[0].productId).stock + 5,
    );
    assert.equal(result.stockAdjustments.length, 1);
    assert.match(result.stockAdjustments[0].reason, /Received PO-/);
    assert.deepEqual(products, before);
    for (const p of result.products)
        if (p.id !== lines[0].productId)
            assert.deepEqual(
                p,
                products.find((item) => item.id === p.id),
            );
    assert.throws(() => receivePurchase(result.order, result.products, result.stockAdjustments));
    assert.throws(() =>
        receivePurchase(
            { ...order, status: "Cancelled", cancelledAt: new Date().toISOString() },
            products,
            [],
        ),
    );
});
test("multi-item receipt is all or nothing; overflow and full history block changes", () => {
    const items = supplier.productIds.map((productId) => ({
            productId,
            quantity: 2,
            unitCost: 100,
        })),
        order = createPurchase(supplier, items, products);
    const result = receivePurchase(order, products, []);
    assert.equal(result.stockAdjustments.length, items.length);
    const overflow = products.map((p) =>
            p.id === items[1].productId ? { ...p, stock: 10000000 } : p,
        ),
        copy = structuredClone(overflow);
    assert.throws(() => receivePurchase(order, overflow, []));
    assert.deepEqual(overflow, copy);
    assert.throws(() => receivePurchase(order, products, Array(10000).fill({})));
});
test("invalid/duplicate product lines, foreign product links, bad quantities and costs are rejected", () => {
    for (const invalid of [
        [],
        [...lines, ...lines],
        [{ ...lines[0], productId: "foreign" }],
        [{ ...lines[0], quantity: 0 }],
        [{ ...lines[0], quantity: 1.5 }],
        [{ ...lines[0], unitCost: -1 }],
        [{ ...lines[0], unitCost: 1.001 }],
    ])
        assert.throws(() => createPurchase(supplier, invalid, products));
    assert.throws(() => createPurchase(undefined, lines, products));
    assert.throws(() => createPurchase(supplier, lines, products, "", "2026-02-30"));
    const order = createPurchase(supplier, lines, products);
    assert.equal(validPurchaseOrders([order, order], products), false);
    assert.equal(validPurchaseOrders([{ ...order, status: "Received" }], products), false);
});
test("purchase history backs up/restores with legacy defaults and survives supplier removal", () => {
    const order = createPurchase(supplier, lines, products),
        document = { ...sample, purchaseOrders: [order] };
    assert.deepEqual(readNotebookBackup(createNotebookBackup(document)).document.purchaseOrders, [
        order,
    ]);
    assert.deepEqual(
        readNotebookBackup(createNotebookBackup({ products: [], orders: [] })).document
            .purchaseOrders,
        [],
    );
    assert.doesNotThrow(() => createNotebookBackup({ ...document, suppliers: [] }));
});
test("partial deliveries add only new units and complete from the outstanding balance", () => {
    const order = createPurchase(supplier, lines, products),
        id = lines[0].productId,
        start = products.find((p) => p.id === id).stock;
    const first = receivePurchase(order, products, [], { [id]: 2 });
    assert.equal(first.order.status, "Partially received");
    assert.equal(first.order.items[0].receivedQuantity, 2);
    assert.equal(first.products.find((p) => p.id === id).stock, start + 2);
    const final = receivePurchase(first.order, first.products, first.stockAdjustments);
    assert.equal(final.order.status, "Received");
    assert.equal(final.order.items[0].receivedQuantity, 5);
    assert.equal(final.products.find((p) => p.id === id).stock, start + 5);
    assert.equal(final.stockAdjustments.length, 2);
    assert.throws(() => receivePurchase(final.order, final.products, final.stockAdjustments));
    assert.deepEqual(
        readNotebookBackup(
            createNotebookBackup({
                ...sample,
                products: first.products,
                purchaseOrders: [first.order],
                stockAdjustments: first.stockAdjustments,
            }),
        ).document.purchaseOrders,
        [first.order],
    );
});
test("zero, negative, fractional, unknown and excessive partial receipts fail without stock changes", () => {
    const order = createPurchase(supplier, lines, products),
        id = lines[0].productId,
        copy = structuredClone(products);
    for (const delivery of [
        {},
        { [id]: 0 },
        { [id]: -1 },
        { [id]: 1.5 },
        { [id]: 6 },
        { foreign: 1 },
    ])
        assert.throws(() => receivePurchase(order, products, [], delivery));
    assert.deepEqual(products, copy);
    const part = receivePurchase(order, products, [], { [id]: 2 });
    assert.throws(() =>
        receivePurchase(part.order, part.products, part.stockAdjustments, { [id]: 4 }),
    );
    const cancelled = { ...part.order, status: "Cancelled", cancelledAt: new Date().toISOString() };
    assert.equal(validPurchaseOrders([cancelled], part.products), true);
    assert.equal(cancelled.items[0].receivedQuantity, 2);
    assert.throws(() => receivePurchase(cancelled, part.products, part.stockAdjustments));
});
test("partial status and received counters must agree; legacy completed purchases stay completed", () => {
    const order = createPurchase(supplier, lines, products);
    for (const changed of [
        { ...order, status: "Partially received" },
        { ...order, items: order.items.map((i) => ({ ...i, receivedQuantity: 1 })) },
        { ...order, items: order.items.map((i) => ({ ...i, receivedQuantity: -1 })) },
    ])
        assert.equal(validPurchaseOrders([changed], products), false);
    const legacy = { ...order, status: "Received", receivedAt: new Date().toISOString() };
    assert.equal(validPurchaseOrders([legacy], products), true);
    assert.throws(() => receivePurchase(legacy, products, []));
    const multi = createPurchase(
        supplier,
        supplier.productIds.map((productId) => ({ productId, quantity: 5, unitCost: 100 })),
        products,
    );
    const part = receivePurchase(multi, products, [], { [multi.items[0].productId]: 3 });
    assert.equal(part.order.items[1].receivedQuantity, 0);
    assert.equal(part.stockAdjustments.length, 1);
});
