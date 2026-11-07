// Real isolated relational database, mocked object store/management calls. No real identities removed.
const fs = require("node:fs"),
    path = require("node:path"),
    assert = require("node:assert/strict"),
    crypto = require("node:crypto");
require("@next/env").loadEnvConfig(process.cwd());
const env = fs.readFileSync(".env.migration-test", "utf8");
process.env.DATABASE_URL = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();
(async () => {
    let api, client;
    const owner = "deletion_qa_" + crypto.randomUUID(),
        other = "deletion_other_" + crypto.randomUUID(),
        originalFetch = global.fetch;
    try {
        fs.writeFileSync(
            ".next/deletion-test-entry.ts",
            "export * from '../lib/delete-account';export * from '../lib/account-lifecycle';",
        );
        global.__deletionFiles = new Map([
            [`notebooks/${owner}/file`, "file"],
            [`profiles/${owner}/avatar.webp`, "avatar"],
            [`notebooks/${other}/file`, "other"],
        ]);
        let failFiles = true,
            failIdentity = true,
            removedIdentities = 0;
        global.__deleteFixtureFile = (key) => {
            if (failFiles) {
                failFiles = false;
                throw Error("Fixture store failure");
            }
            global.__deletionFiles.delete(key);
        };
        const storageFile = path.resolve(".next/deletion-storage.cjs");
        fs.writeFileSync(
            storageFile,
            "exports.storage=()=>({list:async({prefix,limit})=>({items:[...global.__deletionFiles.keys()].filter(key=>key.startsWith(prefix)).slice(0,limit).map(key=>({key}))}),delete:async key=>global.__deleteFixtureFile(key)});",
        );
        // Use a virtual store, retaining all actual lifecycle/SQL implementation.
        await require("esbuild").build({
            entryPoints: [".next/deletion-test-entry.ts"],
            outfile: ".next/deletion-test.cjs",
            bundle: true,
            platform: "node",
            format: "cjs",
            packages: "external",
            plugins: [
                {
                    name: "fixture-storage",
                    setup(build) {
                        build.onResolve({ filter: /^\.\/storage$/ }, () => ({ path: storageFile }));
                    },
                },
            ],
        });
        global.fetch = async (url, options) => {
            if (String(url).startsWith("https://console.neon.tech/api/v2/")) {
                if (options?.method === "DELETE") {
                    assert.ok(String(url).endsWith("/users/" + owner));
                    if (failIdentity) {
                        failIdentity = false;
                        return new Response(null, { status: 503 });
                    }
                    removedIdentities++;
                    return new Response(null, { status: 204 });
                }
                return Response.json({ base_url: process.env.NEON_AUTH_BASE_URL });
            }
            return originalFetch(url, options);
        };
        api = require(path.resolve(".next/deletion-test.cjs"));
        client = await api.lifecyclePool().connect();
        const { createSampleNotebook } = await import("../lib/sample-notebook.mjs"),
            { createNotebookPatch } = await import("../lib/notebook-patch.mjs");
        const doc = createSampleNotebook();
        for (const id of [owner, other])
            await client.query("select * from seller_commit_changes($1,0,$2,$3::jsonb)", [
                id,
                "Deletion fixture",
                JSON.stringify(createNotebookPatch({}, doc)),
            ]);
        let release, entered;
        const entry = new Promise((r) => (entered = r)),
            gate = new Promise((r) => (release = r));
        const upload = api.withAccountUpload(owner, async () => {
            entered();
            await gate;
        });
        await entry;
        let frozen = false;
        const preparation = api.prepareAccountDeletion(owner).then((value) => {
            frozen = true;
            return value;
        });
        await new Promise((r) => setTimeout(r, 200));
        assert.equal(frozen, false);
        release();
        await upload;
        let receipt = await preparation;
        console.log("PASS deletion preparation waits for in-flight owner uploads");
        assert.ok(await api.accountDeleting(owner));
        assert.equal(await api.accountDeleting(other), false);
        await assert.rejects(() =>
            api.withAccountUpload(owner, async () => {
                throw Error("Must not start upload");
            }),
        );
        await assert.rejects(
            () =>
                client.query("update seller_products set name=$2 where owner_id=$1", [
                    owner,
                    "Blocked",
                ]),
            (e) => e.code === "55000",
        );
        await client.query("update seller_products set name=$2 where owner_id=$1", [
            other,
            "Other account remains editable",
        ]);
        console.log(
            "PASS frozen-account uploads and record writes reject while the other account stays usable",
        );
        const old = receipt;
        receipt = await api.prepareAccountDeletion(owner);
        assert.equal(await api.advanceAccountDeletion(old.id, old.token), null);
        assert.equal(await api.advanceAccountDeletion(receipt.id, "x".repeat(43)), null);
        await assert.rejects(() => api.advanceAccountDeletion(receipt.id, receipt.token));
        assert.equal(
            (
                await client.query("select phase from seller_account_deletions where owner_id=$1", [
                    owner,
                ])
            ).rows[0].phase,
            "files",
        );
        assert.equal((await api.advanceAccountDeletion(receipt.id, receipt.token)).phase, "files");
        assert.equal(global.__deletionFiles.size, 1);
        assert.ok(global.__deletionFiles.has(`notebooks/${other}/file`));
        assert.equal(
            (await api.advanceAccountDeletion(receipt.id, receipt.token)).phase,
            "records",
        );
        console.log(
            "PASS receipt rotation, wrong-token rejection and retryable owner-only file cleanup",
        );
        assert.equal(
            (await api.advanceAccountDeletion(receipt.id, receipt.token)).phase,
            "identity",
        );
        assert.equal(
            (
                await client.query(
                    "select count(*)::int count from seller_notebooks where owner_id=$1",
                    [owner],
                )
            ).rows[0].count,
            0,
        );
        assert.equal(
            (
                await client.query(
                    "select count(*)::int count from seller_products where owner_id=$1",
                    [other],
                )
            ).rows[0].count,
            doc.products.length,
        );
        await assert.rejects(() => api.advanceAccountDeletion(receipt.id, receipt.token));
        assert.equal(
            (
                await client.query("select phase from seller_account_deletions where owner_id=$1", [
                    owner,
                ])
            ).rows[0].phase,
            "identity",
        );
        assert.equal(
            (await api.advanceAccountDeletion(receipt.id, receipt.token)).phase,
            "complete",
        );
        assert.equal(
            (await api.advanceAccountDeletion(receipt.id, receipt.token)).phase,
            "complete",
        );
        assert.equal(removedIdentities, 1);
        assert.ok(await api.accountDeleting(owner));
        console.log(
            "PASS complete relational cleanup, identity-failure retry, terminal idempotence and retained session barrier",
        );
    } catch (error) {
        console.error("FAIL", String(error.message).split("\n")[0]);
        process.exitCode = 1;
    } finally {
        global.fetch = originalFetch;
        if (client) {
            for (const id of [owner, other]) {
                await client.query("BEGIN");
                await client.query("select set_config('seller.account_cleanup',$1,true)", [id]);
                await client.query("delete from seller_notebooks where owner_id=$1", [id]);
                await client.query("delete from seller_account_deletions where owner_id=$1", [id]);
                await client.query("COMMIT");
            }
            client.release();
        }
        await api?.lifecyclePool().end();
    }
})();
