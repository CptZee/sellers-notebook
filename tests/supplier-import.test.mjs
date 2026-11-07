import test from "node:test";
import assert from "node:assert/strict";
import { readSupplierCsv, previewSupplierImport } from "../lib/supplier-import.mjs";
import { createSampleNotebook } from "../lib/sample-notebook.mjs";
const products = createSampleNotebook("2026-11-05").products.slice(0, 2);
function preview(csv, existing = [], items = products) {
    const parsed = readSupplierCsv(csv);
    return previewSupplierImport(parsed.rows, parsed.mapping, existing, items);
}
test("supplier CSV accepts export/template headings, optional contacts, and case-insensitive semicolon SKU links", () => {
    const result = preview(
        `Supplier,Contact person,Email,Phone,Lead time (days),Product SKUs,Notes\nStudio,Alex,alex@example.com,+63123,7,${products[0].sku.toLowerCase()};${products[1].sku};${products[0].sku},Sample`,
    );
    assert.deepEqual(result.errors, []);
    assert.equal(result.suppliers.length, 1);
    assert.equal(result.suppliers[0].leadTimeDays, 7);
    assert.equal(result.suppliers[0].phone, "+63123");
    assert.deepEqual(
        result.suppliers[0].productIds,
        products.map((p) => p.id),
    );
    const minimal = preview("Supplier\nOne studio");
    assert.equal(minimal.suppliers[0].leadTimeDays, 0);
    assert.deepEqual(minimal.suppliers[0].productIds, []);
});
test("existing suppliers are skipped without edits; repeated names in a CSV block confirmation", () => {
    const existing = preview("Supplier\nStudio").suppliers,
        copy = structuredClone(existing);
    assert.equal(preview("Supplier,Email\n studio ,invalid", existing).duplicates, 1);
    assert.deepEqual(existing, copy);
    assert.equal(preview("Supplier\nStudio\nSTUDIO").errors.length, 1);
});
test("invalid lead times, email, missing inventory links, and capacity block import", () => {
    for (const lead of ["-1", "1.5", "3651", "Infinity"])
        assert.ok(preview(`Supplier,Lead time (days)\nStudio,${lead}`).errors.length);
    assert.ok(preview("Supplier,Email\nStudio,invalid").errors.length);
    assert.ok(preview("Supplier,Product SKUs\nStudio,unknown").errors.length);
    assert.ok(
        preview(
            "Supplier\nNew studio",
            Array.from({ length: 1000 }, (_, i) => ({ name: `Old ${i}` })),
        ).errors.length,
    );
});
test("malformed/ambiguous headers, empty files, oversized files, and excessive rows are rejected", () => {
    for (const csv of [
        "",
        "Email\nx@y.com",
        "Supplier,Name\nOne,Two",
        "Supplier,SUPPLIER\nOne,Two",
        "Supplier\n",
        "Supplier\n" + Array(1001).fill("One").join("\n"),
        "x".repeat(2 * 1024 * 1024 + 1),
    ])
        assert.throws(() => readSupplierCsv(csv));
});
