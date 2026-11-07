import test from "node:test";
import assert from "node:assert/strict";
import { parseExpensesQuery } from "../lib/expenses-query.mjs";
test("expense pages validate category, date/channel scope and bounds while preserving literal title/notes search", () => {
    const result = parseExpensesQuery(
        new URLSearchParams(
            "revision=2&page=3&size=50&period=all&channel=Shopee&category=Software&search=%20%25_",
        ),
        "2026-11-06",
    );
    assert.equal(result.page, 3);
    assert.equal(result.size, 50);
    assert.equal(result.category, "Software");
    assert.equal(result.search, " %_");
    assert.equal(result.channel, "Shopee");
    for (const query of [
        "revision=1&category=Unknown",
        "revision=1&channel=Business",
        "revision=1&size=101",
        "revision=-1",
        "revision=1&period=custom&from=2026-02-30&to=2026-11-06",
    ])
        assert.throws(() => parseExpensesQuery(new URLSearchParams(query), "2026-11-06"));
});
