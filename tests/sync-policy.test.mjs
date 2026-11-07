import test from "node:test";
import assert from "node:assert/strict";
import {
    syncConfigured,
    authorizedSyncWorker,
    syncPreferences,
    syncFailure,
} from "../lib/sync-policy.mjs";
test("worker authorization fails closed and uses a dedicated exact bearer token", () => {
    const env = { MARKETPLACE_SYNC_ENABLED: "true", MARKETPLACE_SYNC_SECRET: "x".repeat(40) };
    assert.equal(syncConfigured({}), false);
    assert.equal(syncConfigured({ ...env, MARKETPLACE_SYNC_SECRET: "short" }), false);
    assert.equal(syncConfigured({ ...env, MARKETPLACE_SYNC_ENABLED: "false" }), false);
    assert.equal(authorizedSyncWorker("Bearer " + "x".repeat(40), env), true);
    for (const header of [
        null,
        "x".repeat(40),
        "Bearer wrong",
        "bearer " + "x".repeat(40),
        "Bearer " + "x".repeat(40) + " ",
    ])
        assert.equal(authorizedSyncWorker(header, env), false);
});
test("schedules require explicit opt-in and bounded cadence/lookback/shop values", () => {
    const input = { action: "configure", enabled: true, intervalMinutes: 360, lookbackDays: 2 };
    assert.deepEqual(syncPreferences(input), {
        enabled: true,
        intervalMinutes: 360,
        lookbackDays: 2,
        shopCipher: null,
    });
    for (const extra of [
        { enabled: "true" },
        { intervalMinutes: 1 },
        { lookbackDays: 0 },
        { lookbackDays: 8 },
        { lookbackDays: 1.5 },
        { shopCipher: "x".repeat(101) },
        { owner: "foreign" },
    ])
        assert.throws(() => syncPreferences({ ...input, ...extra }));
});
test("transient provider retries back off and stop after three attempts; unsupported payloads never auto retry", () => {
    assert.equal(syncFailure(Error("The marketplace request failed."), 1).retry, true);
    assert.equal(syncFailure(Error("The marketplace request failed."), 1).delaySeconds, 60);
    assert.equal(syncFailure(Error("The marketplace request failed."), 2).delaySeconds, 120);
    assert.equal(syncFailure(Error("The marketplace request failed."), 3).retry, false);
    const failure = syncFailure(Error("PRIVATE-TOKEN unsupported payload"), 1);
    assert.equal(failure.retry, false);
    assert.ok(!failure.message.includes("PRIVATE"));
    assert.equal(syncFailure(Error("This shop is refreshing its authorization."), 1).retry, true);
});
