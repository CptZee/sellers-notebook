import test from "node:test";
import assert from "node:assert/strict";
import { filterSuppliers } from "../lib/supplier-list.mjs";
import { notebookExport } from "../lib/notebook-export.mjs";
import { createSampleNotebook } from "../lib/sample-notebook.mjs";
test("supplier search includes contact fields and linked products/SKUs with literal, stable name sorting", () => {
    const products = [{ id: "p", name: "Paper %_", sku: "P-1" }],
        suppliers = [
            {
                id: "z",
                name: "Alpha",
                contact: "Jo",
                email: "jo@example.com",
                phone: "123",
                productIds: ["p"],
            },
            {
                id: "a",
                name: "alpha",
                contact: "Kim",
                email: "kim@example.com",
                phone: "456",
                productIds: [],
            },
            {
                id: "dup",
                name: "Alpha",
                contact: "Same name second",
                email: "",
                phone: "",
                productIds: [],
            },
        ],
        before = structuredClone(suppliers);
    assert.deepEqual(
        filterSuppliers(suppliers, products, "P-1").map((s) => s.id),
        ["z"],
    );
    assert.deepEqual(
        filterSuppliers(suppliers, products, "%_").map((s) => s.id),
        ["z"],
    );
    assert.deepEqual(
        filterSuppliers(suppliers, products, "JO@EXAMPLE").map((s) => s.id),
        ["z"],
    );
    assert.deepEqual(
        filterSuppliers(suppliers, products, "456").map((s) => s.id),
        ["a"],
    );
    assert.deepEqual(
        filterSuppliers(suppliers, products).map((s) => s.id),
        suppliers.toSorted((a, b) => a.name.localeCompare(b.name)).map((s) => s.id),
    );
    assert.deepEqual(suppliers, before);
});
test("supplier CSV exports every match with product links, private fields and safe quoting without mutating records", () => {
    const document = createSampleNotebook("2026-11-06");
    document.suppliers[0].name = " =FORMULA()";
    document.suppliers[0].notes = 'Quoted, "note"';
    const before = structuredClone(document);
    const result = notebookExport(document, new URLSearchParams("kind=suppliers"), "2026-11-06");
    assert.equal(result.filename, "notebook-suppliers.csv");
    assert.equal(result.csv.split("\r\n").length, 101);
    assert.ok(result.csv.includes('"\' =FORMULA()"'));
    assert.ok(result.csv.includes('"Quoted, ""note"""'));
    assert.ok(result.csv.includes(document.products[0].sku));
    const filtered = notebookExport(
        document,
        new URLSearchParams(
            "kind=suppliers&search=" + encodeURIComponent(document.products[0].sku),
        ),
        "2026-11-06",
    );
    assert.equal(filtered.csv.split("\r\n").length, 2);
    assert.deepEqual(document, before);
});
