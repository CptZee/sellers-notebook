import test from "node:test";
import assert from "node:assert/strict";
import { stockTargets, restockPlan } from "../lib/restock-plan.mjs";
import { validDocument } from "../lib/notebook-validation.mjs";
import { readInventoryCsv, previewInventoryImport } from "../lib/inventory-import.mjs";
const product = {
    id: "p1",
    name: "Mug",
    sku: "MUG-1",
    category: "Home",
    stock: 8,
    cost: 100,
    price: 300,
    color: "#eeeeee",
    symbol: "☕",
};
test("legacy products use alert 10 and target 20 without changing current stock", () => {
    assert.deepEqual(stockTargets(product), { reorderPoint: 10, targetStock: 20 });
    const plan = restockPlan([product]);
    assert.equal(plan[0].quantity, 12);
    assert.equal(plan[0].estimatedCost, 1200);
    assert.equal(product.stock, 8);
});
test("custom alert thresholds are inclusive and targets determine needed units", () => {
    assert.equal(restockPlan([{ ...product, reorderPoint: 7, targetStock: 15 }]).length, 0);
    const plan = restockPlan([{ ...product, reorderPoint: 8, targetStock: 15 }]);
    assert.equal(plan[0].quantity, 7);
    assert.equal(
        restockPlan([{ ...product, stock: 0, reorderPoint: 0, targetStock: 1 }])[0].quantity,
        1,
    );
});
test("product validation rejects fractional, negative, and inconsistent stock targets", () => {
    for (const settings of [
        { reorderPoint: -1 },
        { reorderPoint: 1.5 },
        { reorderPoint: 10, targetStock: 10 },
        { targetStock: 5 },
        { targetStock: 10000001 },
    ])
        assert.equal(validDocument({ products: [{ ...product, ...settings }], orders: [] }), false);
    assert.equal(
        validDocument({ products: [{ ...product, reorderPoint: 2, targetStock: 8 }], orders: [] }),
        true,
    );
});
test("inventory CSV supports optional stock levels and rejects invalid targets", () => {
    const text =
        "Product name,SKU,Unit cost,Selling price,Stock,Reorder point,Target stock\nMug,MUG-1,100,300,8,5,15\n";
    const data = readInventoryCsv(text),
        result = previewInventoryImport(data.rows, data.mapping, []);
    assert.equal(result.products[0].reorderPoint, 5);
    assert.equal(result.products[0].targetStock, 15);
    const bad = readInventoryCsv(text.replace(",5,15", ",5,4"));
    assert.ok(previewInventoryImport(bad.rows, bad.mapping, []).errors.length);
});
