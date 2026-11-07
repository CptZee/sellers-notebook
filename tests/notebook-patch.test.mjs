import test from "node:test";
import assert from "node:assert/strict";
import { createNotebookPatch, applyNotebookPatch } from "../lib/notebook-patch.mjs";
import { createSampleNotebook } from "../lib/sample-notebook.mjs";
import { validDocument } from "../lib/notebook-validation.mjs";
const record = (id) => ({ id, name: id });
test("record deltas preserve prepend, append, deletion, edits and deliberate reorder without sending unchanged records", () => {
    for (const next of [
        [record("new"), record("a"), record("b")],
        [record("a"), record("b"), record("new")],
        [record("b")],
        [{ ...record("a"), name: "edited" }, record("b")],
        [record("b"), record("a")],
        [record("z"), record("b"), record("y"), record("a")],
        [],
    ]) {
        const before = { products: [record("a"), record("b")] },
            after = { products: next };
        const patch = createNotebookPatch(before, after);
        assert.deepEqual(applyNotebookPatch(before, patch).products, next);
        assert.deepEqual(before.products, [record("a"), record("b")]);
    }
    const patch = createNotebookPatch(
        { products: [record("a"), record("b")] },
        { products: [record("new"), record("a"), record("b")] },
    );
    assert.equal(patch.products.upsert.length, 1);
    assert.equal(patch.products.order, undefined);
});
test("multi-collection receipt and payment changes round-trip together and metadata can clear branding", () => {
    const before = createSampleNotebook(),
        after = structuredClone(before),
        purchase = after.purchaseOrders[0],
        line = purchase.items[0],
        product = after.products.find((p) => p.id === line.productId);
    product.stock += line.quantity;
    purchase.status = "Received";
    purchase.receivedAt = new Date().toISOString();
    purchase.items.forEach((item) => (item.receivedQuantity = item.quantity));
    after.sidebarNote = "New note";
    after.branding = null;
    const patch = createNotebookPatch(before, after),
        result = applyNotebookPatch(before, patch);
    assert.deepEqual(result, after);
    assert.ok(validDocument(result));
    assert.equal(patch.products.upsert.length, 1);
    assert.equal(patch.purchaseOrders.upsert.length, 1);
    assert.equal(patch.orders, undefined);
    assert.ok(JSON.stringify(patch).length < JSON.stringify(before).length / 10);
});
test("record operations reject unknown collections, duplicates, impossible positions and invalid ordering", () => {
    const original = { products: [record("a")] };
    for (const patch of [
        { owner_id: "other" },
        { products: { remove: ["missing"], upsert: [] } },
        { products: { remove: ["a", "a"], upsert: [] } },
        {
            products: {
                remove: [],
                upsert: [
                    { index: 0, record: record("b") },
                    { index: 1, record: record("b") },
                ],
            },
        },
        { products: { remove: [], upsert: [{ index: 9, record: record("b") }] } },
        { products: { remove: [], upsert: [], order: ["unknown"] } },
        { products: { remove: [], upsert: [], order: ["a", "a"] } },
        { products: { remove: [], upsert: [], bad: true } },
        {},
    ])
        assert.throws(() => applyNotebookPatch(original, patch));
    assert.deepEqual(original, { products: [record("a")] });
});
test("unchanged object key ordering creates no delta and partial patches preserve untouched fields", () => {
    const before = {
        products: [{ id: "a", name: "A" }],
        orders: [],
        sidebarNote: "Private",
        branding: null,
    };
    assert.deepEqual(
        createNotebookPatch(before, { ...before, products: [{ name: "A", id: "a" }] }),
        {},
    );
    assert.equal(applyNotebookPatch(before, { sidebarNote: "" }).sidebarNote, "");
    assert.equal(applyNotebookPatch(before, { branding: null }).products, before.products);
});
