import test from "node:test";
import assert from "node:assert/strict";
import {
    createNotebookBackup,
    readNotebookBackup,
    backupFingerprint,
} from "../lib/notebook-backup.mjs";
const document = {
    products: [],
    orders: [],
    expenses: [],
    sidebarNote: "A private note",
    branding: null,
    stockAdjustments: [],
    refundRecords: [],
    suppliers: [],
    purchaseOrders: [],
};
test("versioned backups round-trip notebook data without account or connection credentials", () => {
    const text = createNotebookBackup(document, new Date("2026-11-05T10:00:00Z"));
    const data = readNotebookBackup(text);
    assert.deepEqual(data.document, document);
    assert.equal(data.exportedAt, "2026-11-05T10:00:00.000Z");
    assert.deepEqual(Object.keys(JSON.parse(text)), [
        "format",
        "version",
        "exportedAt",
        "document",
    ]);
});
test("legacy notebook fields normalize to defaults and fingerprints ignore JSONB object-key order", () => {
    const legacy = readNotebookBackup(createNotebookBackup({ products: [], orders: [] }));
    assert.deepEqual(legacy.document.expenses, []);
    assert.equal(legacy.document.branding, null);
    assert.equal(
        backupFingerprint(document),
        backupFingerprint({
            stockAdjustments: [],
            branding: null,
            sidebarNote: "A private note",
            expenses: [],
            orders: [],
            products: [],
        }),
    );
    assert.notEqual(
        backupFingerprint(document),
        backupFingerprint({ ...document, sidebarNote: "Changed elsewhere" }),
    );
});
test("corrupt, unsupported, invalid, and oversized backups are rejected before restore", () => {
    assert.throws(() => readNotebookBackup("not json"));
    const valid = JSON.parse(createNotebookBackup(document));
    for (const bad of [
        { ...valid, version: 999 },
        { ...valid, format: "another-app" },
        { ...valid, document: { ...document, sidebarNote: 42 } },
        { ...valid, exportedAt: "invalid" },
    ])
        assert.throws(() => readNotebookBackup(JSON.stringify(bad)));
    assert.throws(() => readNotebookBackup("x".repeat(8 * 1024 * 1024 + 1)));
});
