import test from "node:test";
import assert from "node:assert/strict";
import { parseOrdersQuery } from "../lib/orders-query.mjs";
test("paged order queries validate filters, bound sizes and normalize SKU/source search", () => {
    const parsed = parseOrdersQuery(
        new URLSearchParams(
            "revision=3&page=2&size=50&period=all&channel=Shopee&status=Processing&sort=value&search=%20SHP-001%20",
        ),
        "2026-11-06",
    );
    assert.equal(parsed.page, 2);
    assert.equal(parsed.size, 50);
    assert.equal(parsed.search, "SHP-001");
    assert.equal(parsed.period, "all");
    assert.equal(parsed.channel, "Shopee");
    assert.equal(parsed.status, "Processing");
    assert.equal(parsed.sort, "value");
    for (const query of [
        "revision=1&status=unknown",
        "revision=1&sort=invalid",
        "revision=1&channel=Unknown",
        "revision=1&page=0",
        "revision=1&size=1000",
        "revision=-1",
        "revision=1&period=custom&from=2026-02-30&to=2026-11-06",
    ])
        assert.throws(() => parseOrdersQuery(new URLSearchParams(query), "2026-11-06"));
});
