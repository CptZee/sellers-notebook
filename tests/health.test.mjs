import test from "node:test";
import assert from "node:assert/strict";
import { liveness, readiness } from "../lib/health.mjs";
const secret = "fixture-monitor-secret-with-at-least-32-characters";
const request = (authorization) =>
    new Request("http://localhost/api/health/ready", {
        headers: authorization ? { Authorization: authorization } : {},
    });
test("liveness is uncached and independent of database credentials", async () => {
    const response = liveness();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok" });
    assert.equal(response.headers.get("cache-control"), "no-store");
});
test("readiness fails closed without configured monitoring authentication", async () => {
    for (const value of [undefined, "", "short"]) {
        let calls = 0;
        const response = await readiness(request("Bearer " + secret), {
            secret: value,
            probe: async () => {
                calls++;
            },
        });
        assert.equal(response.status, 503);
        assert.equal(calls, 0);
        assert.deepEqual(await response.json(), { status: "unavailable" });
    }
});
test("missing, incorrect and oversized credentials never run a database probe", async () => {
    for (const value of [
        undefined,
        "Basic " + secret,
        "Bearer wrong",
        "Bearer " + secret + "extra",
        "Bearer " + "x".repeat(1100),
    ]) {
        let calls = 0;
        const response = await readiness(request(value), {
            secret,
            probe: async () => {
                calls++;
            },
        });
        assert.equal(response.status, 401);
        assert.equal(calls, 0);
        assert.deepEqual(await response.json(), { status: "unauthorized" });
        assert.equal(response.headers.get("cache-control"), "no-store");
    }
});
test("authorized readiness probes once and hides dependency failures", async () => {
    let calls = 0;
    const response = await readiness(request("Bearer " + secret), {
        secret,
        probe: async () => {
            calls++;
        },
    });
    assert.equal(calls, 1);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ready" });
    const failed = await readiness(request("Bearer " + secret), {
        secret,
        probe: async () => {
            throw Error("postgres://private-password@private-host");
        },
    });
    assert.equal(failed.status, 503);
    assert.deepEqual(await failed.json(), { status: "unavailable" });
    assert.equal(failed.headers.get("vary"), "Authorization");
});
