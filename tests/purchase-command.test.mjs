import test from "node:test";
import assert from "node:assert/strict";
import { purchaseCommand } from "../lib/purchase-command.mjs";
import { applyNotebookPatch } from "../lib/notebook-patch.mjs";
import { createSampleNotebook } from "../lib/sample-notebook.mjs";
import { validDocument } from "../lib/notebook-validation.mjs";
const command = (kind, order, input, extra = {}) => ({
    kind,
    id: order.id,
    expected: order,
    ...(input === undefined ? {} : { input }),
    ...extra,
});
const financial = (amount = 1) => ({
    amount,
    date: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date()),
    method: "Cash",
    reference: "Private reference",
    notes: "Private notes",
});
test("targeted purchase creation derives names/SKUs, preserves stock and rejects stale/unlinked/duplicate records", () => {
    const document = createSampleNotebook(),
        expected = document.suppliers[1],
        product = document.products.find((p) => expected.productIds.includes(p.id)),
        input = {
            lines: [{ productId: product.id, quantity: 5, unitCost: 2.25 }],
            notes: "Purchase draft",
            expectedDate: "",
        },
        create = { kind: "create", id: "new-purchase", expected, input },
        next = applyNotebookPatch(document, purchaseCommand(document, create));
    assert.equal(next.purchaseOrders[0].id, "new-purchase");
    assert.equal(next.purchaseOrders[0].items[0].productName, product.name);
    assert.equal(next.purchaseOrders[0].items[0].sku, product.sku);
    assert.deepEqual(next.products, document.products);
    assert.deepEqual(next.orders, document.orders);
    assert.ok(validDocument(next));
    assert.throws(() => purchaseCommand(next, create), /already recorded/);
    assert.throws(
        () => purchaseCommand(document, { ...create, expected: { ...expected, name: "Stale" } }),
        /supplier changed/,
    );
    assert.throws(
        () =>
            purchaseCommand(document, {
                ...create,
                input: { ...input, lines: [{ productId: "missing", quantity: 1, unitCost: 2 }] },
            }),
        /linked/,
    );
});
test("partial and remaining receipts atomically change only linked stock, received counts and new history", () => {
    const document = createSampleNotebook(),
        order = document.purchaseOrders[1],
        item = order.items[0],
        before = document.products.find((p) => p.id === item.productId).stock,
        partial = applyNotebookPatch(
            document,
            purchaseCommand(
                document,
                command("receive", order, { delivery: { [item.productId]: 2 } }),
            ),
        );
    assert.equal(partial.purchaseOrders[1].status, "Partially received");
    assert.equal(partial.products.find((p) => p.id === item.productId).stock, before + 2);
    assert.equal(partial.stockAdjustments.length, document.stockAdjustments.length + 1);
    assert.deepEqual(partial.expenses, document.expenses);
    assert.deepEqual(partial.orders, document.orders);
    const complete = applyNotebookPatch(
        partial,
        purchaseCommand(partial, command("receive", partial.purchaseOrders[1], {})),
    );
    assert.equal(complete.purchaseOrders[1].status, "Received");
    assert.equal(
        complete.products.find((p) => p.id === item.productId).stock,
        before + item.quantity,
    );
    assert.ok(validDocument(complete));
    assert.throws(
        () => purchaseCommand(complete, command("receive", order, {})),
        /purchase changed/,
    );
});
test("receipt overflow/history limits and invalid inputs reject without partial stock changes", () => {
    const document = createSampleNotebook(),
        order = document.purchaseOrders[1],
        before = JSON.stringify(document);
    for (const input of [
        { delivery: null },
        { delivery: [] },
        { delivery: { missing: 1 } },
        { delivery: { [order.items[0].productId]: order.items[0].quantity + 1 } },
        { unexpected: true },
    ])
        assert.throws(() => purchaseCommand(document, command("receive", order, input)));
    const fullHistory = {
        ...document,
        stockAdjustments: Array(10000).fill(document.stockAdjustments[0]),
    };
    assert.throws(() => purchaseCommand(fullHistory, command("receive", order, {})), /history/);
    assert.equal(JSON.stringify(document), before);
});
test("schedule and cancellation preserve received stock and retain financial history", () => {
    const document = createSampleNotebook(),
        order = document.purchaseOrders[1],
        scheduled = applyNotebookPatch(
            document,
            purchaseCommand(document, command("schedule", order, { date: "2026-12-01" })),
        ),
        partial = applyNotebookPatch(
            scheduled,
            purchaseCommand(
                scheduled,
                command("receive", scheduled.purchaseOrders[1], {
                    delivery: { [order.items[0].productId]: 1 },
                }),
            ),
        ),
        cancelled = applyNotebookPatch(
            partial,
            purchaseCommand(partial, command("cancel", partial.purchaseOrders[1])),
        );
    assert.equal(cancelled.purchaseOrders[1].status, "Cancelled");
    assert.deepEqual(cancelled.products, partial.products);
    assert.deepEqual(cancelled.purchaseOrders[1].payments, order.payments);
    assert.ok(validDocument(cancelled));
    assert.throws(
        () => purchaseCommand(cancelled, command("receive", cancelled.purchaseOrders[1], {})),
        /outstanding/,
    );
});
test("payment/refund commands keep stable IDs, caps and supporting payment safeguards", () => {
    const document = createSampleNotebook(),
        index = 1,
        order = { ...document.purchaseOrders[index], payments: [] };
    document.purchaseOrders[index] = order;
    const paid = applyNotebookPatch(
        document,
        purchaseCommand(
            document,
            command("payment", order, financial(20), { entryId: "stable-payment" }),
        ),
    );
    assert.equal(paid.purchaseOrders[index].payments[0].id, "stable-payment");
    assert.deepEqual(paid.products, document.products);
    assert.throws(
        () =>
            purchaseCommand(
                paid,
                command("payment", paid.purchaseOrders[index], financial(), {
                    entryId: "stable-payment",
                }),
            ),
        /already saved/,
    );
    const cancelled = applyNotebookPatch(
            paid,
            purchaseCommand(paid, command("cancel", paid.purchaseOrders[index])),
        ),
        refunded = applyNotebookPatch(
            cancelled,
            purchaseCommand(
                cancelled,
                command("refund", cancelled.purchaseOrders[index], financial(10), {
                    entryId: "stable-refund",
                }),
            ),
        );
    assert.equal(refunded.purchaseOrders[index].supplierRefunds[0].id, "stable-refund");
    assert.throws(
        () =>
            purchaseCommand(
                refunded,
                command("remove-payment", refunded.purchaseOrders[index], {
                    recordId: "stable-payment",
                }),
            ),
        /supports/,
    );
    assert.throws(
        () =>
            purchaseCommand(
                refunded,
                command("refund", refunded.purchaseOrders[index], financial(11), {
                    entryId: "excess",
                }),
            ),
        /credit/,
    );
    const corrected = applyNotebookPatch(
            refunded,
            purchaseCommand(
                refunded,
                command("remove-refund", refunded.purchaseOrders[index], {
                    recordId: "stable-refund",
                }),
            ),
        ),
        unpaid = applyNotebookPatch(
            corrected,
            purchaseCommand(
                corrected,
                command("remove-payment", corrected.purchaseOrders[index], {
                    recordId: "stable-payment",
                }),
            ),
        );
    assert.equal(unpaid.purchaseOrders[index].payments.length, 0);
    assert.ok(validDocument(unpaid));
    assert.deepEqual(unpaid.products, document.products);
    assert.deepEqual(unpaid.expenses, document.expenses);
});
