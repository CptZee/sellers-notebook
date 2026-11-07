import test from "node:test";
import assert from "node:assert/strict";
import { parseRecordQuery, recordChanges } from "../lib/notebook-record.mjs";
import { applyNotebookPatch } from "../lib/notebook-patch.mjs";
import { createSampleNotebook } from "../lib/sample-notebook.mjs";
import { validDocument } from "../lib/notebook-validation.mjs";
const input = (collection, record, expected = null) => ({
    collection,
    record,
    expected,
    id: record?.id || expected?.id,
    revision: 3,
});
test("individual lookups constrain collection, identity length and revision", () => {
    assert.deepEqual(
        parseRecordQuery(new URLSearchParams("collection=products&id=one&revision=0")),
        { collection: "products", id: "one", revision: 0 },
    );
    for (const query of [
        "collection=orders&revision=1",
        "collection=expenses",
        "collection=products&revision=-1",
        "collection=products&revision=1.1",
        "collection=products&revision=1&id=" + "x".repeat(101),
    ])
        assert.throws(() => parseRecordQuery(new URLSearchParams(query)));
});
test("record edits preserve array order, unseen data and linked history without mutating the original", () => {
    const document = createSampleNotebook(),
        expected = structuredClone(document.products[105]),
        record = { ...expected, name: "Revised product" },
        before = JSON.stringify(document),
        changes = recordChanges(document, input("products", record, expected)),
        next = applyNotebookPatch(document, changes);
    assert.equal(changes.products.upsert[0].index, 105);
    assert.deepEqual(next.products[105], record);
    assert.equal(JSON.stringify(document), before);
    for (const key of [
        "orders",
        "expenses",
        "suppliers",
        "purchaseOrders",
        "stockAdjustments",
        "refundRecords",
    ])
        assert.deepEqual(next[key], document[key]);
    assert.deepEqual(next.products.slice(0, 105), document.products.slice(0, 105));
});
test("targeted writes reject stale expected records, duplicate SKUs and direct stock edits", () => {
    const document = createSampleNotebook(),
        product = document.products[0],
        expense = document.expenses[0];
    assert.throws(
        () =>
            recordChanges(
                document,
                input("products", { ...product, name: "Draft" }, { ...product, name: "Old" }),
            ),
        /changed/,
    );
    assert.throws(
        () =>
            recordChanges(
                document,
                input("products", { ...product, stock: product.stock + 1 }, product),
            ),
        /Stock adjustments/,
    );
    assert.throws(
        () =>
            recordChanges(
                document,
                input(
                    "products",
                    { ...product, sku: document.products[1].sku.toUpperCase() },
                    product,
                ),
            ),
        /SKU/,
    );
    assert.throws(
        () =>
            recordChanges(
                document,
                input(
                    "expenses",
                    { ...expense, title: "Draft" },
                    { ...expense, amount: expense.amount + 1 },
                ),
            ),
        /expense changed/,
    );
    assert.throws(
        () => recordChanges(document, input("products", null, product)),
        /cannot be removed/,
    );
});
test("new records and deletions change only the selected collection and respect insertion positions", () => {
    const document = createSampleNotebook(),
        expense = { ...document.expenses[0], id: "new-expense" },
        product = { ...document.products[0], id: "new-product", sku: "NEW-SKU" };
    assert.equal(recordChanges(document, input("expenses", expense)).expenses.upsert[0].index, 0);
    assert.equal(
        recordChanges(document, input("products", product)).products.upsert[0].index,
        document.products.length,
    );
    const next = applyNotebookPatch(
        document,
        recordChanges(document, input("expenses", null, document.expenses[50])),
    );
    assert.equal(next.expenses.length, document.expenses.length - 1);
    assert.deepEqual(next.products, document.products);
    assert.ok(!next.expenses.some((row) => row.id === document.expenses[50].id));
});
test("unexpected fields, identity changes and incomplete preconditions are rejected", () => {
    const document = createSampleNotebook(),
        record = document.expenses[0],
        values = input("expenses", record, record);
    for (const changed of [
        { ...values, other: true },
        { ...values, id: "other" },
        { ...values, record: [] },
        { ...values, expected: undefined },
        { ...values, collection: "suppliers" },
    ])
        assert.throws(() => recordChanges(document, changed));
});
test("supplier edits retain unseen links and historical purchase names without changing stock", () => {
    const document = createSampleNotebook(),
        expected = document.suppliers[20],
        record = {
            ...expected,
            name: "Updated contact name",
            productIds: [...expected.productIds, document.products[19].id].filter(
                (id, index, ids) => ids.indexOf(id) === index,
            ),
        },
        next = applyNotebookPatch(
            document,
            recordChanges(document, input("suppliers", record, expected)),
        );
    assert.deepEqual(next.suppliers[20], record);
    assert.deepEqual(next.suppliers.slice(0, 20), document.suppliers.slice(0, 20));
    assert.deepEqual(next.products, document.products);
    assert.deepEqual(next.purchaseOrders, document.purchaseOrders);
    assert.ok(validDocument(next));
});
test("targeted supplier removal preserves inventory and archived purchase references", () => {
    const document = createSampleNotebook(),
        expected = document.suppliers[0],
        next = applyNotebookPatch(
            document,
            recordChanges(document, input("suppliers", null, expected)),
        );
    assert.equal(next.suppliers.length, document.suppliers.length - 1);
    assert.ok(next.purchaseOrders.some((order) => order.supplierId === expected.id));
    assert.deepEqual(next.purchaseOrders, document.purchaseOrders);
    assert.deepEqual(next.products, document.products);
    assert.ok(validDocument(next));
});
test("supplier writes reject stale contacts and missing or duplicate product links", () => {
    const document = createSampleNotebook(),
        expected = document.suppliers[0];
    assert.throws(
        () =>
            recordChanges(
                document,
                input(
                    "suppliers",
                    { ...expected, name: "Draft" },
                    { ...expected, phone: "Old phone" },
                ),
            ),
        /supplier changed/,
    );
    for (const productIds of [
        ["missing"],
        [document.products[0].id, document.products[0].id],
        null,
        Array(3001).fill(document.products[0].id),
    ])
        assert.throws(
            () =>
                recordChanges(document, input("suppliers", { ...expected, productIds }, expected)),
            /product links/,
        );
    assert.equal(
        parseRecordQuery(new URLSearchParams("collection=suppliers&revision=2")).collection,
        "suppliers",
    );
});
