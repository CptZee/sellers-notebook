import test from "node:test";
import assert from "node:assert/strict";
import { orderCommand } from "../lib/order-command.mjs";
import { applyNotebookPatch } from "../lib/notebook-patch.mjs";
import { createSampleNotebook } from "../lib/sample-notebook.mjs";
const today = "2026-11-06",
    sale = (product, overrides = {}) => ({
        kind: "sale",
        id: "new-sale",
        expected: product,
        input: {
            customer: "Buyer",
            channel: "Direct",
            quantity: 2,
            fee: 8,
            packaging: 15,
            shipping: 0,
            date: today,
            ...overrides,
        },
    });
test("sale reserves only selected product stock and captures server prices/costs atomically", () => {
    const document = createSampleNotebook(today),
        product = document.products[50],
        before = JSON.stringify(document),
        changes = orderCommand(document, sale(product), today),
        next = applyNotebookPatch(document, changes);
    assert.equal(next.products[50].stock, product.stock - 2);
    assert.equal(next.orders.length, document.orders.length + 1);
    assert.deepEqual(next.orders[0], {
        id: "new-sale",
        productId: product.id,
        productName: product.name,
        customer: "Buyer",
        channel: "Direct",
        quantity: 2,
        price: product.price,
        cost: product.cost,
        fee: 8,
        packaging: 15,
        shipping: 0,
        date: today,
        status: "Processing",
    });
    assert.equal(JSON.stringify(document), before);
    for (const key of [
        "expenses",
        "purchaseOrders",
        "suppliers",
        "stockAdjustments",
        "refundRecords",
    ])
        assert.deepEqual(next[key], document[key]);
});
test("sale rejects stale stock/price, excessive quantities, forged financial fields and replayed identity", () => {
    const document = createSampleNotebook(today),
        product = document.products[1];
    assert.throws(
        () => orderCommand(document, sale({ ...product, price: product.price + 1 }), today),
        /product changed/,
    );
    for (const input of [
        { quantity: product.stock + 1 },
        { quantity: 1.5 },
        { price: 1 },
        { status: "Completed" },
        { fee: 100 },
        { date: "2026-02-30" },
        { customer: " " },
        { channel: "Other" },
    ])
        assert.throws(() => orderCommand(document, sale(product, input), today));
    assert.throws(
        () => orderCommand(document, { ...sale(product), id: document.orders[0].id }, today),
        /already recorded/,
    );
});
test("targeted refunds preserve stock and cap against all previous refunds in cents", () => {
    const document = createSampleNotebook(today),
        order = document.orders.find((o) => o.status === "Completed"),
        input = { orderId: order.id, amount: 1.23, date: today, reason: "Already refunded" },
        command = { kind: "refund", id: "new-refund", expected: order, input },
        next = applyNotebookPatch(document, orderCommand(document, command, today));
    assert.equal(next.refundRecords[0].id, "new-refund");
    assert.equal(next.refundRecords[0].amount, 1.23);
    assert.deepEqual(next.products, document.products);
    assert.deepEqual(next.orders, document.orders);
    assert.throws(
        () =>
            orderCommand(
                document,
                { ...command, input: { ...input, amount: order.price * order.quantity + 1 } },
                today,
            ),
        /cannot exceed/,
    );
    assert.throws(
        () =>
            orderCommand(
                document,
                { ...command, expected: { ...order, customer: "Old customer" } },
                today,
            ),
        /order changed/,
    );
    assert.throws(() => orderCommand(next, command, today), /already recorded/);
});
test("refund correction requires the exact record and removes only that bookkeeping entry", () => {
    const document = createSampleNotebook(today),
        expected = document.refundRecords[60],
        command = { kind: "remove-refund", id: expected.id, expected },
        next = applyNotebookPatch(document, orderCommand(document, command, today));
    assert.equal(next.refundRecords.length, document.refundRecords.length - 1);
    assert.deepEqual(next.products, document.products);
    assert.deepEqual(next.orders, document.orders);
    assert.throws(
        () =>
            orderCommand(
                document,
                { ...command, expected: { ...expected, amount: expected.amount + 1 } },
                today,
            ),
        /refund changed/,
    );
    assert.throws(() => orderCommand(document, { ...command, unrelated: true }, today), /Invalid/);
});
test("bulk completion changes only selected processing lines and preserves stored order and stock", () => {
    const document = createSampleNotebook(today),
        expected = document.orders.filter((order) => order.status === "Processing").slice(0, 3),
        next = applyNotebookPatch(
            document,
            orderCommand(
                document,
                {
                    kind: "transition",
                    id: "complete-batch",
                    input: { action: "Completed" },
                    expected,
                },
                today,
            ),
        );
    assert.deepEqual(next.products, document.products);
    assert.deepEqual(
        next.orders.map((order) => order.id),
        document.orders.map((order) => order.id),
    );
    for (const row of next.orders)
        assert.equal(
            row.status,
            expected.some((item) => item.id === row.id)
                ? "Completed"
                : document.orders.find((item) => item.id === row.id).status,
        );
    for (const key of ["expenses", "refundRecords", "purchaseOrders", "stockAdjustments"])
        assert.deepEqual(next[key], document[key]);
});
test("bulk cancellation combines manual reservations for a shared product and excludes imported history", () => {
    const document = createSampleNotebook(today),
        product = document.products[1],
        base = document.orders[0],
        rows = [
            {
                ...base,
                id: "manual-a",
                productId: product.id,
                quantity: 2,
                status: "Processing",
                stockApplied: undefined,
            },
            {
                ...base,
                id: "manual-b",
                productId: product.id,
                quantity: 3,
                status: "Processing",
                stockApplied: true,
            },
            {
                ...base,
                id: "imported",
                productId: product.id,
                quantity: 7,
                status: "Processing",
                stockApplied: false,
            },
        ];
    document.orders.push(...rows);
    const changes = orderCommand(
            document,
            {
                kind: "transition",
                id: "cancel-batch",
                input: { action: "Cancelled" },
                expected: rows,
            },
            today,
        ),
        next = applyNotebookPatch(document, changes);
    assert.equal(changes.products.upsert.length, 1);
    assert.equal(next.products[1].stock, product.stock + 5);
    assert.ok(
        next.orders
            .filter((order) => rows.some((row) => row.id === order.id))
            .every((order) => order.status === "Cancelled"),
    );
    assert.deepEqual(next.refundRecords, document.refundRecords);
    assert.throws(
        () =>
            orderCommand(
                next,
                {
                    kind: "transition",
                    id: "replay",
                    input: { action: "Cancelled" },
                    expected: rows,
                },
                today,
            ),
        /changed/,
    );
});
test("transition rejects stale, missing, duplicate and oversized selections without partial changes", () => {
    const document = createSampleNotebook(today),
        order = document.orders.find((order) => order.status === "Processing"),
        before = JSON.stringify(document),
        command = {
            kind: "transition",
            id: "batch",
            input: { action: "Completed" },
            expected: [order],
        };
    for (const expected of [
        [],
        [order, order],
        [{ ...order, customer: "Stale" }],
        [{ ...order, id: "missing" }],
        Array.from({ length: 101 }, (_, i) => ({ ...order, id: "row-" + i })),
    ])
        assert.throws(() => orderCommand(document, { ...command, expected }, today));
    assert.throws(() =>
        orderCommand(document, { ...command, input: { action: "Processing" } }, today),
    );
    assert.equal(JSON.stringify(document), before);
    const fullPage = Array.from({ length: 100 }, (_, i) => ({
        ...order,
        id: "full-page-" + i,
        stockApplied: false,
    }));
    document.orders.push(...fullPage);
    assert.equal(
        orderCommand(document, { ...command, expected: fullPage }, today).orders.upsert.length,
        100,
    );
});
test("one unsafe stock restoration rejects the entire cancellation batch", () => {
    const document = createSampleNotebook(today),
        product = document.products[1],
        base = document.orders.find((order) => order.status === "Processing"),
        row = {
            ...base,
            id: "overflow-reservation",
            productId: product.id,
            quantity: 2,
            stockApplied: true,
        };
    document.orders.push(row);
    document.products[1] = { ...product, stock: 10000000 };
    assert.throws(
        () =>
            orderCommand(
                document,
                {
                    kind: "transition",
                    id: "unsafe",
                    input: { action: "Cancelled" },
                    expected: [base, row],
                },
                today,
            ),
        /Stock cannot/,
    );
    assert.equal(document.orders.find((order) => order.id === base.id).status, "Processing");
    assert.equal(document.products[1].stock, 10000000);
});
