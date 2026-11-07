import test from "node:test";
import assert from "node:assert/strict";
import { transitionOrders, filterOrderList } from "../lib/order-management.mjs";
const products = [{ id: "p1", sku: "MUG-1", stock: 5 }];
const orders = [
    {
        id: "manual",
        productId: "p1",
        productName: "Mug",
        customer: "Ana",
        quantity: 2,
        price: 100,
        status: "Processing",
        date: "2026-11-05",
    },
    {
        id: "import",
        sourceOrderId: "LZD-123",
        productId: "p1",
        productName: "Mug",
        customer: "Ben",
        quantity: 4,
        price: 50,
        status: "Processing",
        stockApplied: false,
        date: "2026-11-04",
    },
];
test("bulk cancellation restores reserved manual stock once and leaves imported history unchanged", () => {
    const result = transitionOrders(orders, products, ["manual", "import"], "Cancelled");
    assert.equal(result.products[0].stock, 7);
    assert.equal(result.count, 2);
    assert.ok(result.orders.every((order) => order.status === "Cancelled"));
    assert.equal(products[0].stock, 5);
    assert.throws(() => transitionOrders(result.orders, result.products, ["manual"], "Cancelled"));
});
test("bulk completion changes statuses without reserving stock again", () => {
    const result = transitionOrders(orders, products, ["manual", "import"], "Completed");
    assert.equal(result.products[0].stock, 5);
    assert.ok(result.orders.every((order) => order.status === "Completed"));
});
test("stale selections and impossible stock restoration fail without partially changing orders", () => {
    assert.throws(() => transitionOrders(orders, products, ["manual", "missing"], "Cancelled"));
    assert.throws(() =>
        transitionOrders(orders, [{ ...products[0], stock: 10000000 }], ["manual"], "Cancelled"),
    );
    assert.equal(orders[0].status, "Processing");
});
test("search includes marketplace IDs and SKUs, and filters sort the visible list", () => {
    assert.equal(filterOrderList(orders, products, "lzd-123")[0].id, "import");
    assert.equal(filterOrderList(orders, products, "mug-1").length, 2);
    assert.equal(filterOrderList(orders, products, "", "Completed").length, 0);
    assert.equal(filterOrderList(orders, products, "", "All statuses", "oldest")[0].id, "import");
});
