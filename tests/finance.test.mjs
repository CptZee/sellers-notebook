import { test } from "node:test";
import assert from "node:assert/strict";
import { pricing, orderTotals } from "../lib/finance.mjs";
test("target margin includes fees and all costs", () => {
    const result = pricing(200, 20, 30, 10, 30);
    assert.ok(Math.abs(result.price - 416.6666667) < 0.001);
    assert.ok(Math.abs((result.price - result.base - result.fees) / result.price - 0.3) < 0.0001);
});
test("impossible or invalid margins are rejected", () => {
    assert.equal(pricing(200, 0, 0, 10, 90), null);
    assert.equal(pricing(-1, 0, 0, 0, 20), null);
});
test("orders charge packaging and shipping once per order", () => {
    assert.deepEqual(
        orderTotals({ price: 500, quantity: 2, cost: 200, fee: 10, packaging: 20, shipping: 50 }),
        { revenue: 1000, expense: 570, profit: 430 },
    );
});
test("tax allowance is reserved from gross price while preserving target profit margin", () => {
    const result = pricing(200, 20, 30, 10, 30, 5);
    assert.ok(Math.abs(result.price - 250 / 0.55) < 1e-8);
    assert.ok(
        Math.abs(result.price - result.base - result.fees - result.taxes - result.profit) < 1e-8,
    );
    assert.equal(result.taxes, result.price * 0.05);
    assert.equal(pricing(200, 0, 0, 10, 80, 10), null);
    for (const tax of [-1, NaN, Infinity]) assert.equal(pricing(200, 0, 0, 10, 30, tax), null);
    assert.equal(pricing(200, 0, 0, 10, 30).taxes, 0);
});
