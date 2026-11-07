import test from "node:test";
import assert from "node:assert/strict";
import { validDocument } from "../lib/notebook-validation.mjs";
import { createSampleNotebook } from "../lib/sample-notebook.mjs";
import { createNotebookBackup, readNotebookBackup } from "../lib/notebook-backup.mjs";
test("supplier contacts and links round-trip privately in notebook backups; old backups default empty", () => {
    const sample = createSampleNotebook("2026-11-05");
    assert.equal(sample.suppliers.length, 100);
    assert.equal(validDocument(sample), true);
    assert.deepEqual(
        readNotebookBackup(createNotebookBackup(sample)).document.suppliers,
        sample.suppliers,
    );
    assert.deepEqual(
        readNotebookBackup(createNotebookBackup({ products: [], orders: [] })).document.suppliers,
        [],
    );
});
test("suppliers reject unknown product links, duplicates, invalid contact data, and fractional lead times", () => {
    const sample = createSampleNotebook("2026-11-05"),
        supplier = sample.suppliers[0];
    for (const patch of [
        { name: " " },
        { email: "invalid" },
        { phone: 42 },
        { leadTimeDays: 1.5 },
        { leadTimeDays: -1 },
        { productIds: ["another-account-product"] },
        { productIds: [supplier.productIds[0], supplier.productIds[0]] },
        { notes: "x".repeat(1001) },
    ])
        assert.equal(validDocument({ ...sample, suppliers: [{ ...supplier, ...patch }] }), false);
    assert.equal(validDocument({ ...sample, suppliers: [supplier, supplier] }), false);
    assert.equal(
        validDocument({
            ...sample,
            suppliers: Array.from({ length: 1001 }, (_, i) => ({ ...supplier, id: String(i) })),
        }),
        false,
    );
});
