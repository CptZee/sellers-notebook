import test from "node:test";
import assert from "node:assert/strict";
import { createSampleNotebook } from "../lib/sample-notebook.mjs";
import { validDocument } from "../lib/notebook-validation.mjs";
import { reportRange, inReportRange } from "../lib/reporting.mjs";
import { createNotebookBackup, readNotebookBackup } from "../lib/notebook-backup.mjs";
test("expanded sample has at least 100 valid records in every business collection", () => {
    const sample = createSampleNotebook("2026-11-05");
    assert.equal(validDocument(sample), true);
    for (const key of ["products", "orders", "expenses", "stockAdjustments", "refundRecords"]) {
        assert.ok(sample[key].length >= 100);
        assert.equal(new Set(sample[key].map((item) => item.id)).size, sample[key].length);
    }
    assert.equal(new Set(sample.products.map((product) => product.sku)).size, 120);
});
test("sample has varied statuses/channels, recent report data, and no future records", () => {
    const sample = createSampleNotebook("2026-01-01"),
        range = reportRange("30", "2026-01-01");
    assert.equal(validDocument(sample), true);
    assert.equal(new Set(sample.orders.map((order) => order.channel)).size, 4);
    assert.equal(new Set(sample.orders.map((order) => order.status)).size, 3);
    assert.ok(sample.orders.filter((order) => inReportRange(order.date, range)).length >= 100);
    assert.ok(
        sample.expenses.filter((expense) => inReportRange(expense.date, range)).length >= 100,
    );
    for (const record of [...sample.orders, ...sample.expenses, ...sample.refundRecords])
        assert.ok(record.date <= "2026-01-01");
});
test("sample stock reconciles opening deliveries and active historical sales", () => {
    const sample = createSampleNotebook("2026-11-05");
    for (const product of sample.products) {
        const delivery = sample.stockAdjustments.find((change) => change.productId === product.id);
        const sold = sample.orders
            .filter((order) => order.productId === product.id && order.status !== "Cancelled")
            .reduce((sum, order) => sum + order.quantity, 0);
        assert.equal(product.stock, delivery.after - sold);
        assert.ok(product.stock >= 0);
    }
    assert.ok(sample.products.some((product) => product.stock === 0));
});
test("sample generation is deterministic for the anchor date and round-trips through backups", () => {
    const sample = createSampleNotebook("2026-11-05");
    assert.deepEqual(createSampleNotebook("2026-11-05"), sample);
    const restored = readNotebookBackup(createNotebookBackup(sample));
    assert.deepEqual(restored.document, sample);
});
