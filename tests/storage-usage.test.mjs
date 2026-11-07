import test from "node:test";
import assert from "node:assert/strict";
import { storageUsage, formatStorage, GIB } from "../lib/storage-usage.mjs";

test("Free-edition storage tracks usage above former tier limits without an allowance", () => {
    const usage = storageUsage(40 * GIB, 1024, 2048);
    assert.equal(usage.usedBytes, 40 * GIB + 3072);
    assert.deepEqual(Object.keys(usage), [
        "usedBytes",
        "attachmentBytes",
        "profileBytes",
        "pendingBytes",
    ]);
    assert.equal(formatStorage(40 * GIB), "40 GB");
});

test("Usage rejects invalid byte totals without introducing quota behavior", () => {
    for (const value of [-1, NaN, Infinity, 0.5]) assert.throws(() => storageUsage(value));
    assert.throws(() => storageUsage(Number.MAX_SAFE_INTEGER, 1));
    assert.equal(formatStorage(0), "0 MB");
});
