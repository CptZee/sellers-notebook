import test from "node:test";
import assert from "node:assert/strict";
import { parseReportQuery } from "../lib/report-query.mjs";
test("report filters validate channel, revision, period and Manila date boundaries", () => {
    assert.deepEqual(
        parseReportQuery(new URLSearchParams("period=7&channel=Shopee&revision=3"), "2026-11-06"),
        {
            period: "7",
            channel: "Shopee",
            today: "2026-11-06",
            range: { from: "2026-10-31", to: "2026-11-06", error: "" },
            revision: 3,
        },
    );
    assert.equal(
        parseReportQuery(
            new URLSearchParams("period=custom&from=2026-01-01&to=2026-11-06"),
            "2026-11-06",
        ).range.from,
        "2026-01-01",
    );
    for (const params of [
        "period=invalid",
        "channel=other",
        "revision=-1",
        "revision=1.5",
        "period=custom&from=2026-02-30&to=2026-11-06",
        "period=custom&from=2026-11-07&to=2026-11-08",
    ])
        assert.throws(() => parseReportQuery(new URLSearchParams(params), "2026-11-06"));
});
