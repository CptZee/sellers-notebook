import test from "node:test";
import assert from "node:assert/strict";
import { pageWindow } from "../lib/pagination.mjs";
import { encodeAttachmentCursor, decodeAttachmentCursor } from "../lib/attachment-cursor.mjs";
test("page windows cover every row once and clamp deleted or empty result pages", () => {
    const rows = Array.from({ length: 120 }, (_, i) => i),
        seen = [];
    for (let page = 1; page <= 5; page++) {
        const window = pageWindow(rows.length, page, 25);
        seen.push(...rows.slice(window.start, window.end));
    }
    assert.deepEqual(seen, rows);
    assert.equal(pageWindow(12, 5, 25).page, 1);
    assert.deepEqual(pageWindow(0, 1, 25), {
        page: 1,
        pageSize: 25,
        pages: 1,
        start: 0,
        end: 0,
        total: 0,
    });
});
test("supported page sizes and invalid values remain bounded", () => {
    assert.equal(pageWindow(120, 1, 50).end, 50);
    assert.equal(pageWindow(120, 1, 100).end, 100);
    assert.equal(pageWindow(120, -3, 999).page, 1);
    assert.equal(pageWindow(120, -3, 999).pageSize, 25);
    assert.equal(pageWindow(Infinity).total, 0);
});
test("file cursors retain deterministic timestamp and UUID ordering fields", () => {
    const id = "3d52519f-e281-4d6a-aef9-d49710575e40",
        cursor = encodeAttachmentCursor({ created_at: "2026-11-05T10:00:00Z", id });
    assert.deepEqual(decodeAttachmentCursor(cursor), { date: "2026-11-05T10:00:00Z", id });
    const precise = "2026-11-05 10:00:00.123456+00";
    assert.equal(
        decodeAttachmentCursor(encodeAttachmentCursor({ created_at: precise, id })).date,
        precise,
    );
    assert.equal(decodeAttachmentCursor(null), null);
    for (const value of [
        Buffer.from(JSON.stringify({ date: "2026-02-30T10:00:00.000Z", id })).toString("base64url"),
        "not-json",
        "x".repeat(513),
        Buffer.from(JSON.stringify({ date: "bad", id })).toString("base64url"),
        Buffer.from(JSON.stringify({ date: "2026-11-05T10:00:00.000Z", id: "invalid" })).toString(
            "base64url",
        ),
    ])
        assert.throws(() => decodeAttachmentCursor(value));
});
