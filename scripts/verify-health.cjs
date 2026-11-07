// Owns a temporary local server. No account writes; the live dependency probe is SELECT 1.
const { spawn } = require("node:child_process"),
    path = require("node:path"),
    crypto = require("node:crypto"),
    fs = require("node:fs"),
    assert = require("node:assert/strict");
require("@next/env").loadEnvConfig(process.cwd());
const base = "http://127.0.0.1:3002",
    secret = crypto.randomBytes(32).toString("base64url"),
    checks = [];
const pass = (message) => {
    checks.push(message);
    console.log("PASS " + message);
};
let child;
async function stop() {
    if (!child) return;
    const active = child;
    child = null;
    if (active.exitCode === null) {
        active.kill();
        await new Promise((resolve) => active.once("exit", resolve));
    }
}
async function start(env) {
    child = spawn(
        process.execPath,
        [
            path.resolve("node_modules/next/dist/bin/next"),
            "start",
            "--hostname",
            "127.0.0.1",
            "--port",
            "3002",
        ],
        { windowsHide: true, stdio: "ignore", env: { ...process.env, ...env } },
    );
    child.on("error", () => {});
    for (let i = 0; i < 100; i++) {
        if (child.exitCode !== null) throw Error("Temporary health-check server failed to start.");
        try {
            const response = await fetch(base + "/api/health");
            if (response.ok) return;
        } catch {}
        await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw Error("Temporary health-check server did not become live.");
}
(async () => {
    let failure;
    try {
        try {
            await fetch(base + "/api/health", { signal: AbortSignal.timeout(500) });
            throw Error(
                "Port 3002 is already in use; stop that server before running this verifier.",
            );
        } catch (error) {
            if (error.message.includes("already in use")) throw error;
        }
        await start({ HEALTH_CHECK_SECRET: secret });
        let response = await fetch(base + "/api/health");
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { status: "ok" });
        assert.equal(response.headers.get("cache-control"), "no-store");
        assert.equal((await fetch(base + "/api/health", { method: "POST" })).status, 405);
        pass(
            "Public liveness responds without a session, is uncached and rejects unsupported writes",
        );
        for (const headers of [{}, { Authorization: "Bearer incorrect" }]) {
            response = await fetch(base + "/api/health/ready", { headers });
            assert.equal(response.status, 401);
            assert.deepEqual(await response.json(), { status: "unauthorized" });
        }
        response = await fetch(base + "/api/health/ready", {
            headers: { Authorization: "Bearer " + secret },
        });
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { status: "ready" });
        assert.equal(response.headers.get("cache-control"), "no-store");
        pass(
            "Private readiness rejects missing/wrong credentials and verifies the real database with an authorized read-only query",
        );
        await stop();
        await start({
            HEALTH_CHECK_SECRET: secret,
            DATABASE_URL: "invalid-private-database-configuration",
        });
        response = await fetch(base + "/api/health/ready", {
            headers: { Authorization: "Bearer " + secret },
        });
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), { status: "unavailable" });
        assert.equal((await fetch(base + "/api/health")).status, 200);
        pass(
            "Invalid database configuration returns a sanitized readiness failure while liveness remains available",
        );
        await stop();
        await start({
            HEALTH_CHECK_SECRET: "",
            DATABASE_URL: "invalid-private-database-configuration",
        });
        response = await fetch(base + "/api/health/ready", {
            headers: { Authorization: "Bearer " + secret },
        });
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), { status: "unavailable" });
        pass("Unconfigured readiness fails closed without requiring a working database");
    } catch (error) {
        failure = error;
        console.error("FAIL", String(error.message).split("\n")[0]);
    } finally {
        await stop();
        fs.writeFileSync(
            "verification/health-e2e.json",
            JSON.stringify(
                {
                    passed: !failure,
                    checks,
                    failure: failure ? String(failure.message).split("\n")[0] : null,
                },
                null,
                2,
            ),
        );
    }
    process.exitCode = failure ? 1 : 0;
})();
