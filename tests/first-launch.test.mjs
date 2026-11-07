import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
    { startSetup } = require("../scripts/first-launch.cjs"),
    { fields, readValues, patchEnv } = require("../scripts/setup/config.cjs");
const { migrateLegacyEnv } = require("../scripts/setup/environment-file.cjs");

test("Legacy configuration migrates to .env without resetting completed setup or overwriting conflicts", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "notebook-env-migration-"));
    try {
        const legacy = path.join(root, ".env.local"),
            destination = path.join(root, ".env");
        const original = Buffer.from(
            "# Preserve comments\r\nCUSTOM='fixture-$-value'\r\nEMPTY=\r\n",
        );
        fs.writeFileSync(legacy, original);
        fs.mkdirSync(path.join(root, ".setup"));
        const marker = '{"completedAt":"fixture","version":1}';
        fs.writeFileSync(path.join(root, ".setup/completed.json"), marker);
        assert.equal(migrateLegacyEnv(root), true);
        assert.deepEqual(fs.readFileSync(destination), original);
        assert.equal(fs.existsSync(legacy), false);
        assert.equal(migrateLegacyEnv(root), false);
        await assert.rejects(() => startSetup({ root }), /already complete/);
        assert.equal(fs.readFileSync(path.join(root, ".setup/completed.json"), "utf8"), marker);
        fs.writeFileSync(legacy, "CUSTOM='different'\n");
        assert.throws(() => migrateLegacyEnv(root), { code: "ENV_FILE_CONFLICT" });
        assert.deepEqual(fs.readFileSync(destination), original);
        assert.equal(fs.readFileSync(legacy, "utf8"), "CUSTOM='different'\n");
    } finally {
        assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep));
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test("The interactive installer refuses Vercel runtime before writing local state", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "notebook-hosted-setup-")),
        previous = process.env.VERCEL;
    try {
        process.env.VERCEL = "1";
        await assert.rejects(() => startSetup({ root }), { code: "LOCAL_SETUP_REQUIRED" });
        assert.equal(fs.existsSync(path.join(root, ".setup")), false);
    } finally {
        if (previous === undefined) delete process.env.VERCEL;
        else process.env.VERCEL = previous;
        assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep));
        fs.rmSync(root, { recursive: true, force: true });
    }
});
export const fixtureValues = {
    DATABASE_URL: "postgresql://fixture:private@fixture-pooler.example.test/notebook",
    DATABASE_URL_UNPOOLED: "postgresql://fixture:private@fixture.example.test/notebook",
    NEON_AUTH_BASE_URL: "https://identity.example.test",
    AWS_ACCESS_KEY_ID: "fixture-storage-access",
    AWS_SECRET_ACCESS_KEY: "private-storage-secret",
    AWS_ENDPOINT_URL_S3: "https://storage.example.test",
    AWS_REGION: "ap-southeast-1",
    NEON_REALTIME_URL: "wss://sync.example.test",
    NEON_REALTIME_SECRET: "private-realtime-fixture-secret",
};
test("First-launch installer denies unauthorized access, preserves secrets, saves once and stays locked across restart", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "notebook-setup-test-"));
    let setup;
    try {
        fs.copyFileSync(".env.example", path.join(root, ".env.example"));
        const raw = patchEnv(
            '# Existing installation\nUNRELATED="keep this # literal"\n',
            fixtureValues,
        );
        fs.writeFileSync(path.join(root, ".env"), raw);
        setup = await startSetup({ root, shutdown: false });
        const u = new URL(setup.url),
            origin = u.origin,
            base = origin + u.pathname,
            token = u.hash.slice(1),
            headers = {
                Authorization: "Bearer " + token,
                Origin: origin,
                "Content-Type": "application/json",
            };
        assert.equal(setup.server.address().address, "127.0.0.1");
        assert.equal((await fetch(base + "/configuration")).status, 404);
        assert.equal((await fetch(origin + "/setup")).status, 404);
        assert.equal(
            (await fetch(base + "/configuration", { headers: { Authorization: "Bearer bad" } }))
                .status,
            404,
        );
        const response = await fetch(base + "/configuration", { headers }),
            text = await response.text();
        assert.equal(response.headers.get("cache-control"), "no-store");
        for (const value of Object.values(fixtureValues))
            assert.equal(text.includes(value), false, "Never return existing values");
        assert.equal(JSON.parse(text).fields.length, fields(root).length);
        await assert.rejects(() => startSetup({ root }), /already running/);
        const post = (body, extra = {}) =>
                fetch(base + "/configuration", {
                    method: "POST",
                    headers: { ...headers, ...extra },
                    body: JSON.stringify(body),
                }),
            valid = { values: {}, generate: ["NEON_AUTH_COOKIE_SECRET"], acknowledged: true };
        assert.equal((await post(valid, { Origin: "https://evil.example" })).status, 403);
        assert.equal((await post({ ...valid, acknowledged: false })).status, 400);
        assert.equal((await post({ ...valid, values: { UNRECOGNIZED: "value" } })).status, 400);
        assert.equal(
            (
                await post({
                    ...valid,
                    values: { HEALTH_CHECK_SECRET: "a".repeat(32) + "\nINJECTED=true" },
                })
            ).status,
            422,
        );
        assert.equal(
            (await post({ ...valid, values: { DATABASE_URL_UNPOOLED: "not-a-url" } })).status,
            422,
        );
        assert.equal(
            (
                await post({
                    ...valid,
                    values: {
                        DATABASE_URL_UNPOOLED:
                            "postgresql://fixture:private@foreign.example.test/notebook",
                    },
                })
            ).status,
            422,
        );
        assert.equal(fs.readFileSync(path.join(root, ".env"), "utf8"), raw);
        const health = "fixture-dollar-$-and-quote-'-secret".padEnd(48, "x"),
            attempts = await Promise.all([
                post({ ...valid, values: { HEALTH_CHECK_SECRET: health } }),
                post({ ...valid, values: { HEALTH_CHECK_SECRET: health } }),
            ]);
        assert.deepEqual(attempts.map((r) => r.status).sort(), [200, 404]);
        const saved = attempts.find((r) => r.status === 200);
        assert.equal(saved.status, 200);
        const result = await saved.text();
        assert.equal(result.includes(health), false);
        const updated = fs.readFileSync(path.join(root, ".env"), "utf8");
        assert.ok(updated.includes('UNRELATED="keep this # literal"'));
        for (const [key, value] of Object.entries(fixtureValues))
            assert.equal(readValues(root, fields(root))[key], value);
        const loaded = readValues(root, fields(root));
        assert.equal(loaded.HEALTH_CHECK_SECRET, health);
        assert.match(loaded.NEON_AUTH_COOKIE_SECRET, /^[a-f0-9]{64}$/);
        assert.equal(loaded.ACCOUNT_DELETION_ENABLED, "false");
        assert.equal((await post(valid)).status, 404);
        assert.equal((await fetch(base)).status, 404);
        await new Promise((resolve) => setup.server.close(resolve));
        setup = null;
        await assert.rejects(() => startSetup({ root }), /already complete/);
        assert.equal(fs.existsSync(path.join(root, ".setup/running.json")), false);
    } finally {
        if (setup) await new Promise((resolve) => setup.server.close(resolve));
        const resolved = path.resolve(root);
        assert.ok(
            resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) &&
                path.basename(resolved).startsWith("notebook-setup-test-"),
        );
        fs.rmSync(resolved, { recursive: true, force: true });
    }
});
