// Isolated Postgres + real upload handlers; identity and object storage are fixtures.
const fs = require("node:fs"),
    path = require("node:path"),
    crypto = require("node:crypto"),
    assert = require("node:assert/strict");
require("@next/env").loadEnvConfig(process.cwd());
const env = fs.readFileSync(".env.storage-test", "utf8"),
    target = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();
if (new URL(target).hostname === new URL(process.env.DATABASE_URL).hostname)
    throw Error("Use an isolated branch.");
process.env.DATABASE_URL = target;
const owners = ["files_" + crypto.randomUUID(), "files_" + crypto.randomUUID()],
    checks = [],
    objects = new Map();
global.__fileFixture = { user: null, objects, failUpload: false, failDelete: false };
const pass = (text) => {
    checks.push(text);
    console.log("PASS " + text);
};
let api, client, failure;
const request = (route, method = "GET", body, headers = {}) =>
    new Request("http://localhost" + route, {
        method,
        headers: { Host: "localhost", Origin: "http://localhost", ...headers },
        ...(body === undefined ? {} : { body }),
    });
(async () => {
    try {
        fs.mkdirSync(".next", { recursive: true });
        fs.writeFileSync(
            ".next/free-files-entry.ts",
            "export * as attachments from '../app/api/attachments/route';export * as attachment from '../app/api/attachments/[id]/route';export * as profile from '../app/api/profile-picture/route';export * as account from '../app/api/account/storage/route';export * from '../lib/account-lifecycle';export * from '../lib/account-storage';",
        );
        await require("esbuild").build({
            entryPoints: [".next/free-files-entry.ts"],
            outfile: ".next/free-files.mjs",
            bundle: true,
            platform: "node",
            format: "esm",
            packages: "external",
            plugins: [
                {
                    name: "file-fixture",
                    setup(build) {
                        build.onResolve({ filter: /auth\/server$/ }, () => ({
                            path: "auth",
                            namespace: "fixture",
                        }));
                        build.onResolve({ filter: /(^\.\/storage$|\/lib\/storage$)/ }, () => ({
                            path: "storage",
                            namespace: "fixture",
                        }));
                        build.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
                            loader: "js",
                            resolveDir: process.cwd(),
                            contents:
                                args.path === "auth"
                                    ? "export const auth={getSession:async()=>({data:{user:global.__fileFixture.user}})};"
                                    : `import {FilesError} from 'files-sdk';export const storage=()=>{const s=global.__fileFixture;return {head:async key=>{const value=s.objects.get(key);if(!value)throw new FilesError('NotFound','Missing fixture');return {size:value.length};},upload:async(key,bytes)=>{if(s.failUpload)throw Error('Fixture upload failure');s.objects.set(key,bytes);},delete:async key=>{if(s.failDelete)throw Error('Fixture delete failure');s.objects.delete(key);},download:async key=>{const bytes=s.objects.get(key);if(!bytes)throw new FilesError('NotFound','Missing fixture');return {arrayBuffer:async()=>bytes.buffer};}};};`,
                        }));
                    },
                },
            ],
        });
        api = await import(
            require("node:url").pathToFileURL(path.resolve(".next/free-files.mjs")).href
        );
        client = await api.lifecyclePool().connect();
        const user = (id) =>
            (global.__fileFixture.user = id
                ? { id, name: "Free file review", email: "fixture@example.com" }
                : null);
        const upload = (bytes = Buffer.from("receipt")) =>
            api.attachments.POST(
                request("/api/attachments", "POST", bytes, {
                    "Content-Type": "text/plain",
                    "X-File-Name": "fixture.txt",
                }),
            );
        const usage = async () => {
            const response = await api.account.GET(request("/api/account/storage"));
            assert.equal(response.status, 200);
            return response.json();
        };
        assert.equal((await api.account.GET(request("/api/account/storage"))).status, 401);
        user(owners[0]);
        assert.equal(
            (
                await api.account.GET(
                    request("/api/account/storage", "GET", undefined, {
                        "X-Notebook-User": owners[1],
                    }),
                )
            ).status,
            401,
        );
        assert.equal(
            (
                await api.account.POST(
                    request("/api/account/storage", "POST", JSON.stringify({ allowance: 1 })),
                )
            ).status,
            400,
        );
        assert.equal(
            (
                await api.account.POST(
                    request("/api/account/storage", "POST", JSON.stringify({ action: "recover" }), {
                        Origin: "https://other.test",
                    }),
                )
            ).status,
            403,
        );
        assert.deepEqual(await usage(), {
            usedBytes: 0,
            attachmentBytes: 0,
            profileBytes: 0,
            pendingBytes: 0,
        });
        let response = await upload();
        assert.equal(response.status, 201);
        const file = await response.json();
        assert.equal((await usage()).usedBytes, 7);
        assert.equal(
            (
                await client.query("select revision from seller_notebooks where owner_id=$1", [
                    owners[0],
                ])
            ).rows[0].revision,
            0,
        );
        pass(
            "Owner-only usage and uploads initialize safely without exposing a storage plan or allowance",
        );
        global.__fileFixture.failDelete = true;
        assert.equal(
            (
                await api.attachment.DELETE(request("/api/attachments/" + file.id, "DELETE"), {
                    params: Promise.resolve({ id: file.id }),
                })
            ).status,
            503,
        );
        assert.equal((await usage()).usedBytes, 7);
        global.__fileFixture.failDelete = false;
        assert.equal(
            (
                await api.attachment.DELETE(request("/api/attachments/" + file.id, "DELETE"), {
                    params: Promise.resolve({ id: file.id }),
                })
            ).status,
            200,
        );
        global.__fileFixture.failUpload = true;
        assert.equal((await upload()).status, 503);
        global.__fileFixture.failUpload = false;
        assert.equal((await usage()).pendingBytes, 0);
        const pending = crypto.randomUUID(),
            key = `notebooks/${owners[0]}/${pending}`;
        await api.reserveAttachment(owners[0], pending, key, 100);
        objects.set(key, Buffer.alloc(100));
        await client.query(
            "update seller_storage_reservations set created_at=now()-interval '11 minutes' where id=$1",
            [pending],
        );
        assert.equal(
            (
                await api.account.POST(
                    request("/api/account/storage", "POST", JSON.stringify({ action: "recover" })),
                )
            ).status,
            200,
        );
        assert.equal((await usage()).pendingBytes, 0);
        assert.equal(objects.has(key), false);
        pass(
            "Upload failures, failed deletions and abandoned-upload recovery retain existing safety behavior",
        );
        const existing = 40 * 1024 ** 3;
        await client.query(
            `insert into seller_attachments(id,owner_id,object_key,filename,content_type,size) select gen_random_uuid(),$1,'notebooks/'||$1||'/fixture-'||n,'fixture.txt','text/plain',least(5242880,$2::bigint-(n::bigint-1)*5242880)::integer from generate_series(1,ceil($2::numeric/5242880)::integer) n`,
            [owners[0], existing],
        );
        assert.equal((await usage()).usedBytes, existing);
        response = await upload();
        assert.equal(response.status, 201);
        const races = await Promise.all([upload(Buffer.alloc(6)), upload(Buffer.alloc(6))]);
        assert.deepEqual(
            races.map((r) => r.status),
            [201, 201],
        );
        assert.equal((await usage()).usedBytes, existing + 19);
        assert.equal((await upload(Buffer.alloc(5242881))).status, 400);
        const avatar = Buffer.from("RIFF0000WEBPfixture");
        assert.equal(
            (
                await api.profile.PUT(
                    request("/api/profile-picture", "PUT", avatar, {
                        "Content-Type": "image/webp",
                    }),
                )
            ).status,
            200,
        );
        assert.equal((await usage()).profileBytes, avatar.length);
        pass(
            "Accounts above 40 GB can upload concurrently and change profile pictures; the per-file safety cap remains",
        );
        user(owners[1]);
        assert.equal((await usage()).usedBytes, 0);
        assert.equal((await upload()).status, 201);
        user(owners[0]);
        const schema = await client.query(
            "select table_name,column_name from information_schema.columns where table_schema='public' and (table_name in ('seller_billing_orders','seller_storage_plan_events') or column_name='storage_plan')",
        );
        assert.equal(schema.rowCount, 0);
        pass(
            "The fresh free schema contains no billing tables or storage-plan columns; accounts remain isolated",
        );
    } catch (error) {
        failure = error;
        console.error(error.stack || error);
        process.exitCode = 1;
    } finally {
        if (client) {
            for (const owner of owners) {
                await client.query("delete from seller_attachments where owner_id=$1", [owner]);
                await client.query("delete from seller_notebooks where owner_id=$1", [owner]);
            }
            client.release();
        }
        await api?.lifecyclePool().end();
        fs.writeFileSync(
            "verification/free-storage-branch.json",
            JSON.stringify(
                {
                    passed: !failure,
                    checks,
                    failure: failure?.message || null,
                    mode: "isolated Postgres, actual routes, fixture identity/object storage; no production writes",
                },
                null,
                2,
            ),
        );
    }
})();
