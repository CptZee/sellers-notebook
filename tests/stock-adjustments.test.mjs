import test from "node:test";
import assert from "node:assert/strict";
import { stockChange } from "../lib/stock-adjustments.mjs";
import { validDocument } from "../lib/notebook-validation.mjs";
const product = {
    id: "p1",
    name: "Tote",
    sku: "TOTE-1",
    cost: 100,
    price: 200,
    stock: 7,
    color: "#e2e9df",
    symbol: "📦",
    category: "Bags",
};
test("restocks, damage, and count corrections preserve a before/after record", () => {
    for (const [kind, quantity, after] of [
        ["Restock", 5, 12],
        ["Damage", 2, 5],
        ["Correction", 0, 0],
    ]) {
        const record = stockChange(product, kind, quantity, " Counted stock ");
        assert.equal(record.before, 7);
        assert.equal(record.after, after);
        assert.equal(record.reason, "Counted stock");
        assert.equal(record.sku, "TOTE-1");
        assert.equal(
            validDocument({ products: [product], orders: [], stockAdjustments: [record] }),
            true,
        );
    }
    assert.equal(product.stock, 7);
});
test("invalid quantities, overselling damage, unchanged counts, and missing reasons are rejected", () => {
    for (const args of [
        ["Damage", 8, "Damaged"],
        ["Restock", 0, "Delivery"],
        ["Restock", 1.5, "Delivery"],
        ["Correction", 7, "Count"],
        ["Restock", 10000000, "Too many"],
        ["Restock", 1, " "],
    ])
        assert.throws(() => stockChange(product, ...args));
});
test("history rejects duplicate IDs, contradictory directions, and invalid timestamps", () => {
    const item = stockChange(product, "Restock", 5, "Delivery");
    for (const records of [
        [item, item],
        [{ ...item, after: 2 }],
        [{ ...item, createdAt: "invalid" }],
        [{ ...item, before: -1 }],
    ])
        assert.equal(
            validDocument({ products: [product], orders: [], stockAdjustments: records }),
            false,
        );
});
