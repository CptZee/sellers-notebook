// Uses a new management-created identity only; never accepts an existing account ID.
const fs = require("node:fs"),
    path = require("node:path"),
    assert = require("node:assert/strict"),
    crypto = require("node:crypto");
require("@next/env").loadEnvConfig(process.cwd());
(async () => {
    let api, client, owner, files, config;
    try {
        config = (await import("../lib/account-deletion.mjs")).deletionConfig();
        assert.ok(config, "Configure the dedicated deletion credential first");
        const response = await fetch(config.base + "/users", {
            method: "POST",
            headers: { Authorization: "Bearer " + config.key, "Content-Type": "application/json" },
            body: JSON.stringify({
                email: `delete-worker-${Date.now()}@example.com`,
                name: "Disposable account deletion worker fixture",
            }),
            signal: AbortSignal.timeout(20000),
        });
        assert.ok(response.ok, "Management fixture identity creation failed");
        owner = (await response.json()).id;
        assert.ok(typeof owner === "string" && owner.length > 0);
        fs.writeFileSync(
            ".next/deletion-worker-entry.ts",
            "export * from '../lib/delete-account';export * from '../lib/account-lifecycle';export * from '../lib/storage';",
        );
        require("esbuild").buildSync({
            entryPoints: [".next/deletion-worker-entry.ts"],
            outfile: ".next/deletion-worker.cjs",
            bundle: true,
            platform: "node",
            format: "cjs",
            packages: "external",
        });
        api = require(path.resolve(".next/deletion-worker.cjs"));
        client = await api.lifecyclePool().connect();
        files = api.storage();
        const { createSampleNotebook } = await import("../lib/sample-notebook.mjs"),
            { createNotebookPatch } = await import("../lib/notebook-patch.mjs");
        await client.query("select * from seller_commit_changes($1,0,$2,$3::jsonb)", [
            owner,
            "Disposable deletion fixture",
            JSON.stringify(createNotebookPatch({}, createSampleNotebook())),
        ]);
        for (const key of [
            `notebooks/${owner}/registered`,
            `notebooks/${owner}/orphan`,
            `profiles/${owner}/avatar.webp`,
        ])
            await files.upload(key, Buffer.from("Disposable deletion fixture"), {
                contentType: "text/plain",
            });
        await client.query(
            "insert into seller_attachments(id,owner_id,object_key,filename,content_type,size) values($1,$2,$3,'fixture.txt','text/plain',27)",
            [crypto.randomUUID(), owner, `notebooks/${owner}/registered`],
        );
        const receipt = await api.prepareAccountDeletion(owner);
        for (let i = 0; i < 20; i++) {
            const result = await api.advanceAccountDeletion(receipt.id, receipt.token);
            assert.ok(result);
            if (result.phase === "complete") break;
        }
        assert.equal(
            (
                await client.query("select phase from seller_account_deletions where owner_id=$1", [
                    owner,
                ])
            ).rows[0].phase,
            "complete",
        );
        for (const prefix of [`notebooks/${owner}/`, `profiles/${owner}/`])
            assert.equal((await files.list({ prefix })).items.length, 0);
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
                await client.query('select count(*)::int count from neon_auth."user" where id=$1', [
                    owner,
                ])
            ).rows[0].count,
            0,
        );
        assert.equal(
            (await api.advanceAccountDeletion(receipt.id, receipt.token)).phase,
            "complete",
        );
        console.log(
            "PASS real worker removes registered/orphan files, avatar, relational notebook and a disposable managed Auth identity; completion is idempotent",
        );
        fs.writeFileSync(
            "verification/account-deletion-worker.json",
            JSON.stringify(
                {
                    passed: true,
                    scope: "real Neon database, object storage and project-scoped identity removal; public Auth password flow not exercised",
                },
                null,
                2,
            ),
        );
    } catch (error) {
        console.error("FAIL", String(error.message).split("\n")[0]);
        fs.writeFileSync(
            "verification/account-deletion-worker.json",
            JSON.stringify(
                { passed: false, failure: String(error.message).split("\n")[0] },
                null,
                2,
            ),
        );
        process.exitCode = 1;
    } finally {
        if (owner && config) {
            if (files)
                for (const prefix of [`notebooks/${owner}/`, `profiles/${owner}/`]) {
                    for (;;) {
                        const page = await files.list({ prefix, limit: 100 });
                        if (!page.items.length) break;
                        for (const file of page.items) await files.delete(file.key);
                    }
                }
            if (client) {
                await client.query("BEGIN");
                await client.query("select set_config('seller.account_cleanup',$1,true)", [owner]);
                await client.query("delete from seller_attachments where owner_id=$1", [owner]);
                await client.query("delete from seller_notebooks where owner_id=$1", [owner]);
                await client.query("delete from seller_account_deletions where owner_id=$1", [
                    owner,
                ]);
                await client.query("COMMIT");
            }
            const response = await fetch(config.base + "/users/" + encodeURIComponent(owner), {
                method: "DELETE",
                headers: { Authorization: "Bearer " + config.key },
                signal: AbortSignal.timeout(15000),
            });
            if (!response.ok && response.status !== 404) {
                console.error("Disposable identity cleanup must be retried.");
                process.exitCode = 1;
            }
        }
        client?.release();
        await api?.lifecyclePool().end();
    }
})();
