import test from "node:test";
import assert from "node:assert/strict";
import { stockCommand } from "../lib/stock-command.mjs";
import { applyNotebookPatch } from "../lib/notebook-patch.mjs";
const product = { id: "p", name: "Mug", sku: "MUG", stock: 10 };
const fixture = () => ({
    products: [product, { ...product, id: "other", sku: "OTHER" }],
    orders: [{ id: "sale" }],
    expenses: [{ id: "expense" }],
    stockAdjustments: [],
});
const command = (kind = "Restock", quantity = 3) => ({
    id: "adjustment",
    expected: product,
    input: { kind, quantity, reason: "Count review" },
});
test("stock commands change only the selected quantity and prepend a server-derived history record", () => {
    for (const [kind, quantity, after] of [
        ["Restock", 3, 13],
        ["Damage", 3, 7],
        ["Correction", 0, 0],
    ]) {
        const before = fixture(),
            next = applyNotebookPatch(before, stockCommand(before, command(kind, quantity)));
        assert.equal(next.products[0].stock, after);
        assert.deepEqual(next.products[1], before.products[1]);
        assert.deepEqual(next.orders, before.orders);
        assert.deepEqual(next.expenses, before.expenses);
        assert.deepEqual(
            { ...next.stockAdjustments[0], createdAt: "" },
            {
                id: "adjustment",
                productId: "p",
                productName: "Mug",
                sku: "MUG",
                kind,
                before: 10,
                after,
                reason: "Count review",
                createdAt: "",
            },
        );
        assert.equal(before.products[0].stock, 10);
    }
});
test("stale, missing, duplicate and invalid stock commands do not mutate records", () => {
    const before = fixture(),
        original = structuredClone(before);
    for (const c of [
        { ...command(), expected: { ...product, stock: 9 } },
        { ...command(), expected: { ...product, id: "foreign" } },
        command("Damage", 11),
        command("Restock", 0.5),
        command("Correction", 10),
        { ...command(), input: { kind: "Restock", quantity: 1, reason: "" } },
        { ...command(), extra: true },
    ])
        assert.throws(() => stockCommand(before, c));
    assert.deepEqual(before, original);
    assert.throws(
        () => stockCommand({ ...before, stockAdjustments: [{ id: "adjustment" }] }, command()),
        /already recorded/,
    );
    assert.throws(
        () =>
            stockCommand(
                {
                    ...before,
                    stockAdjustments: Array.from({ length: 10000 }, (_, i) => ({ id: String(i) })),
                },
                command(),
            ),
        /limit/,
    );
});
