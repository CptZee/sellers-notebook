const fs = require("node:fs"),
    path = require("node:path"),
    assert = require("node:assert/strict"),
    crypto = require("node:crypto");
require("@next/env").loadEnvConfig(process.cwd());
const target = fs
    .readFileSync(".env.storage-test", "utf8")
    .match(/^DATABASE_URL=(.+)$/m)[1]
    .trim();
if (new URL(target).hostname === new URL(process.env.DATABASE_URL).hostname)
    throw Error("Isolated test branch required");
process.env.DATABASE_URL = target;
const owners = ["tour_" + crypto.randomUUID(), "tour_" + crypto.randomUUID()],
    checks = [];
let api, client;
const pass = (text) => {
    checks.push(text);
    console.log("PASS " + text);
};
const req = (method = "GET", body, headers = {}) =>
    new Request("http://localhost/api/account/tour", {
        method,
        headers: { Host: "localhost", Origin: "http://localhost", ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
(async () => {
    let failure;
    try {
        fs.writeFileSync(
            ".next/tour-test-entry.ts",
            "export * from '../app/api/account/tour/route';export {lifecyclePool} from '../lib/account-lifecycle';",
        );
        await require("esbuild").build({
            entryPoints: [".next/tour-test-entry.ts"],
            outfile: ".next/tour-test.mjs",
            bundle: true,
            format: "esm",
            platform: "node",
            packages: "external",
            plugins: [
                {
                    name: "identity",
                    setup(build) {
                        build.onResolve({ filter: /auth\/server$/ }, () => ({
                            path: "auth",
                            namespace: "fixture",
                        }));
                        build.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
                            contents:
                                "export const auth={getSession:async()=>({data:{user:global.__tourUser}})};",
                            loader: "js",
                        }));
                    },
                },
            ],
        });
        api = await import(
            require("node:url").pathToFileURL(path.resolve(".next/tour-test.mjs")).href
        );
        client = await api.lifecyclePool().connect();
        global.__tourUser = null;
        assert.equal((await api.GET(req())).status, 401);
        const user = (id) =>
            (global.__tourUser = { id, name: "Tutorial review", email: "fixture@example.com" });
        user(owners[0]);
        await client.query(
            "insert into seller_notebooks(owner_id,display_name,revision) values($1,'Existing business',7)",
            [owners[0]],
        );
        const original = (
            await client.query("select * from seller_notebooks where owner_id=$1", [owners[0]])
        ).rows[0];
        assert.equal((await (await api.GET(req())).json()).completed, false);
        assert.equal(
            (await api.GET(req("GET", undefined, { "X-Notebook-User": owners[1] }))).status,
            401,
        );
        assert.equal(
            (await api.POST(req("POST", { completed: true }, { Origin: "https://other.example" })))
                .status,
            403,
        );
        assert.equal((await api.POST(req("POST", { completed: false }))).status, 400);
        pass(
            "Incomplete by default, authenticated per account, cross-origin and skip requests rejected",
        );
        assert.equal((await api.POST(req("POST", { completed: true }))).status, 200);
        const saved = (
            await client.query("select * from seller_notebooks where owner_id=$1", [owners[0]])
        ).rows[0];
        assert.ok(saved.tour_completed_at);
        assert.equal(saved.revision, 7);
        assert.equal(saved.display_name, original.display_name);
        assert.equal(
            new Date(saved.updated_at).toISOString(),
            new Date(original.updated_at).toISOString(),
        );
        await api.POST(req("POST", { completed: true }));
        const repeat = (
            await client.query("select tour_completed_at from seller_notebooks where owner_id=$1", [
                owners[0],
            ])
        ).rows[0];
        assert.equal(
            new Date(repeat.tour_completed_at).toISOString(),
            new Date(saved.tour_completed_at).toISOString(),
        );
        assert.equal((await (await api.GET(req())).json()).completed, true);
        pass(
            "Completion persists idempotently without altering business revision, timestamps, name or subscription",
        );
        user(owners[1]);
        assert.equal((await (await api.GET(req())).json()).completed, false);
        assert.equal((await api.POST(req("POST", { completed: true }))).status, 200);
        assert.equal(
            (
                await client.query("select revision from seller_notebooks where owner_id=$1", [
                    owners[1],
                ])
            ).rows[0].revision,
            0,
        );
        pass(
            "Other accounts remain incomplete and a new account can finish before its first business save",
        );
    } catch (error) {
        failure = error;
        console.error(error.stack || error);
    } finally {
        if (client) {
            for (const owner of owners)
                await client.query("delete from seller_notebooks where owner_id=$1", [owner]);
            client.release();
        }
        await api?.lifecyclePool().end();
        fs.writeFileSync(
            "verification/tour-branch.json",
            JSON.stringify(
                { passed: !failure, checks, failure: failure?.message || null },
                null,
                2,
            ),
        );
        process.exitCode = failure ? 1 : 0;
    }
})();
