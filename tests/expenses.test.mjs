import { test } from "node:test";
import assert from "node:assert/strict";
import { profitSummary } from "../lib/expenses.mjs";
import { validDocument } from "../lib/notebook-validation.mjs";
const expense = {
    id: "e1",
    title: "Ad campaign",
    category: "Advertising",
    amount: 12.34,
    date: "2026-11-05",
    channel: "Business",
    notes: "",
};
const order = {
    id: "o1",
    productId: "p1",
    productName: "Mug",
    customer: "Buyer",
    channel: "Shopee",
    quantity: 2,
    price: 300,
    cost: 100,
    fee: 10,
    packaging: 15,
    shipping: 0,
    date: "2026-11-05",
    status: "Completed",
};
test("overhead is subtracted once from order profit without changing sales", () => {
    assert.deepEqual(profitSummary([order], [{ ...expense, amount: 25 }]), {
        revenue: 600,
        orderCosts: 275,
        orderProfit: 325,
        overhead: 25,
        netProfit: 300,
    });
});
test("processing and cancelled orders do not produce profit; overhead may produce a loss", () => {
    const result = profitSummary(
        [
            { ...order, status: "Processing" },
            { ...order, id: "o2", status: "Cancelled" },
        ],
        [expense],
    );
    assert.equal(result.revenue, 0);
    assert.equal(result.orderCosts, 0);
    assert.equal(result.netProfit, -12.34);
});
test("small currency values sum in cents", () => {
    assert.equal(
        profitSummary(
            [],
            [
                { ...expense, amount: 0.1 },
                { ...expense, id: "e2", amount: 0.2 },
            ],
        ).overhead,
        0.3,
    );
});
test("existing documents can omit expenses and valid expense ledgers are accepted", () => {
    assert.equal(validDocument({ products: [], orders: [] }), true);
    assert.equal(validDocument({ products: [], orders: [], expenses: [expense] }), true);
});
test("expense records require positive money, valid dates, categories, and unique IDs", () => {
    for (const changes of [
        { amount: 0 },
        { amount: -1 },
        { amount: 0.001 },
        { amount: NaN },
        { date: "2026-02-30" },
        { category: "Unrecognized" },
        { channel: "Someone else" },
        { notes: "a".repeat(1001) },
    ])
        assert.equal(
            validDocument({ products: [], orders: [], expenses: [{ ...expense, ...changes }] }),
            false,
        );
    assert.equal(validDocument({ products: [], orders: [], expenses: [expense, expense] }), false);
});
