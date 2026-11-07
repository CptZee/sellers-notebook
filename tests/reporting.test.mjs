import test from "node:test";
import assert from "node:assert/strict";
import { reportRange, inReportRange, revenueBuckets } from "../lib/reporting.mjs";
test("rolling ranges use today and include both boundaries without future sales", () => {
    const range = reportRange("7", "2026-11-05");
    assert.deepEqual(range, { from: "2026-10-30", to: "2026-11-05", error: "" });
    assert.ok(inReportRange("2026-10-30", range));
    assert.ok(inReportRange("2026-11-05", range));
    assert.equal(inReportRange("2026-11-06", range), false);
});
test("month and all-time ranges include expense-only history and handle empty notebooks", () => {
    assert.equal(reportRange("month", "2026-11-05").from, "2026-11-01");
    assert.equal(
        reportRange("all", "2026-11-05", ["2026-10-01", "2026-01-01", "2027-01-01"]).from,
        "2026-01-01",
    );
    assert.equal(reportRange("all", "2026-11-05").from, "2026-11-05");
});
test("custom dates validate calendar values, reversed ranges, future dates, and leap years", () => {
    for (const [from, to] of [
        ["2026-02-30", "2026-03-01"],
        ["2026-11-05", "2026-11-01"],
        ["2026-11-01", "2026-11-06"],
        ["", ""],
    ])
        assert.ok(reportRange("custom", "2026-11-05", [], from, to).error);
    assert.equal(reportRange("custom", "2026-11-05", [], "2024-02-29", "2024-03-01").error, "");
});
test("chart buckets cover the entire selected period and count completed sales once", () => {
    const range = reportRange("90", "2026-11-05");
    const orders = [
        { date: range.from, status: "Completed", price: 10, quantity: 2 },
        { date: range.to, status: "Completed", price: 0.1, quantity: 3 },
        { date: range.to, status: "Processing", price: 500, quantity: 1 },
        { date: "2027-01-01", status: "Completed", price: 100, quantity: 1 },
    ];
    const buckets = revenueBuckets(orders, range);
    assert.ok(buckets.length <= 14);
    assert.equal(buckets[0].from, range.from);
    assert.equal(buckets.at(-1).to, range.to);
    assert.equal(Math.round(buckets.reduce((sum, b) => sum + b.revenue, 0) * 100), 2030);
});
