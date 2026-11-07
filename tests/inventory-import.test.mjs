import test from "node:test";
import assert from "node:assert/strict";
import { readInventoryCsv, previewInventoryImport } from "../lib/inventory-import.mjs";
import { validDocument } from "../lib/notebook-validation.mjs";
const csv =
    "Product name,SKU,Unit cost,Selling price,Stock,Category,Currency\nCanvas Tote,TOTE-1,145.00,349.00,42,Bags,PHP\n";
const preview = (text = csv, existing = []) => {
    const data = readInventoryCsv(text);
    return previewInventoryImport(data.rows, data.mapping, existing);
};
test("inventory CSV creates validated products with current stock and PHP prices", () => {
    const result = preview();
    assert.deepEqual(result.errors, []);
    assert.equal(result.products[0].stock, 42);
    assert.equal(result.products[0].cost, 145);
    assert.equal(validDocument({ products: result.products, orders: [] }), true);
});
test("known SKUs are case-insensitive and preserve existing price and stock", () => {
    const existing = preview().products;
    existing[0].stock = 8;
    const repeated = preview(csv.replace("TOTE-1", "tote-1"), existing);
    assert.equal(repeated.duplicates, 1);
    assert.equal(repeated.products.length, 0);
    assert.equal(existing[0].stock, 8);
});
test("duplicate file SKUs, negative money, fractional stock, foreign currency, and invalid mappings block import", () => {
    for (const text of [
        csv + csv.split("\n")[1],
        csv.replace("145.00", "-1"),
        csv.replace(",42,", ",1.5,"),
        csv.replace(",PHP", ",USD"),
    ])
        assert.ok(preview(text).errors.length);
    const data = readInventoryCsv(csv);
    data.mapping.stock = "";
    assert.ok(previewInventoryImport(data.rows, data.mapping, []).errors.length);
});
test("optional category defaults and comma-formatted prices are supported", () => {
    const result = preview(csv.replace(",Bags,", ",,").replace("145.00", '"1,145.00"'));
    assert.equal(result.products[0].category, "General");
    assert.equal(result.products[0].cost, 1145);
});
test("inventory notebook capacity prevents oversized product collections", () => {
    const result = preview(
        csv,
        Array.from({ length: 3000 }, (_, i) => ({ sku: "OTHER-" + i })),
    );
    assert.ok(result.errors.some((error) => error.message.includes("3,000")));
});
