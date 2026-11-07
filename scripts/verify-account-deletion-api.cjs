// Real route handlers with stubbed identity/cleanup dependencies; no database or identity mutations.
const fs = require("node:fs"),
    path = require("node:path"),
    assert = require("node:assert/strict");
(async () => {
    try {
        process.env.ACCOUNT_DELETION_ENABLED = "true";
        process.env.NEON_ACCOUNT_DELETION_API_KEY = "fixture-server-key";
        process.env.NEON_ACCOUNT_DELETION_PROJECT_ID = "fixture-project";
        process.env.NEON_ACCOUNT_DELETION_BRANCH_ID = "br-fixture";
        global.__deletionUser = null;
        global.__prepared = 0;
        global.__advanced = 0;
        global.__passwordValid = false;
        await require("esbuild").build({
            entryPoints: ["app/api/account/deletion/route.ts"],
            outfile: ".next/deletion-api-test.cjs",
            bundle: true,
            platform: "node",
            format: "cjs",
            packages: "external",
            plugins: [
                {
                    name: "identity-fixture",
                    setup(build) {
                        build.onResolve({ filter: /auth\/server$/ }, () => ({
                            path: "identity",
                            namespace: "fixture",
                        }));
                        build.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
                            contents: `export const auth={getSession:async()=>({data:{user:global.__deletionUser}}),handler:()=>({POST:async(request,context)=>{if((await context.params).path[0]!=='verify-password')throw Error('Wrong endpoint');return Response.json(global.__passwordValid?{status:true}:{error:'wrong password'},{status:global.__passwordValid?200:400});}})};`,
                            loader: "js",
                        }));
                        build.onResolve({ filter: /lib\/delete-account$/ }, () => ({
                            path: "worker",
                            namespace: "worker",
                        }));
                        build.onLoad({ filter: /.*/, namespace: "worker" }, () => ({
                            contents: `export async function prepareAccountDeletion(owner){if(owner!=='fixture-user')throw Error('Cross-account target');global.__prepared++;return {id:'12345678-1234-4234-8234-123456789012',token:'a'.repeat(43),phase:'files'};}export async function advanceAccountDeletion(){global.__advanced++;return global.__receiptValid?{phase:'complete'}:null;}`,
                            loader: "js",
                        }));
                    },
                },
            ],
        });
        const api = require(path.resolve(".next/deletion-api-test.cjs"));
        const request = (method, body, headers = {}) =>
                new Request("http://localhost/api/account/deletion", {
                    method,
                    headers: {
                        Origin: "http://localhost",
                        "Content-Type": "application/json",
                        ...headers,
                    },
                    body: JSON.stringify(body),
                }),
            valid = { password: "fixture-password", confirmation: "DELETE", acknowledged: true };
        assert.equal((await api.GET()).status, 401);
        assert.equal((await api.POST(request("POST", valid))).status, 401);
        global.__deletionUser = { id: "fixture-user", email: "fixture@example.com" };
        assert.equal((await api.GET()).status, 200);
        process.env.ACCOUNT_DELETION_ENABLED = "false";
        assert.equal((await api.POST(request("POST", valid))).status, 503);
        assert.equal(global.__prepared, 0);
        process.env.ACCOUNT_DELETION_ENABLED = "true";
        assert.equal(
            (await api.POST(request("POST", valid, { Origin: "https://another.example" }))).status,
            403,
        );
        assert.equal(
            (await api.POST(request("POST", valid, { "X-Notebook-User": "other-user" }))).status,
            401,
        );
        for (const body of [
            { ...valid, password: "" },
            { ...valid, confirmation: "delete" },
            { ...valid, acknowledged: false },
            { ...valid, owner: "other-user" },
        ])
            assert.equal((await api.POST(request("POST", body))).status, 400);
        assert.equal((await api.POST(request("POST", valid))).status, 400);
        assert.equal(global.__prepared, 0);
        global.__passwordValid = true;
        assert.equal((await api.POST(request("POST", valid))).status, 200);
        assert.equal(global.__prepared, 1);
        console.log(
            "PASS real prepare handler enforces session, origin, owner, password, typed confirmation and acknowledgement before starting cleanup",
        );
        const token = "a".repeat(43),
            id = "12345678-1234-4234-8234-123456789012";
        assert.equal((await api.DELETE(request("DELETE", { id }))).status, 401);
        assert.equal(
            (
                await api.DELETE(
                    request(
                        "DELETE",
                        { id },
                        { "X-Account-Deletion-Token": token, Origin: "https://another.example" },
                    ),
                )
            ).status,
            403,
        );
        assert.equal(
            (
                await api.DELETE(
                    request(
                        "DELETE",
                        { id, owner: "other-user" },
                        { "X-Account-Deletion-Token": token },
                    ),
                )
            ).status,
            400,
        );
        assert.equal(global.__advanced, 0);
        assert.equal(
            (await api.DELETE(request("DELETE", { id }, { "X-Account-Deletion-Token": token })))
                .status,
            401,
        );
        global.__receiptValid = true;
        assert.equal(
            (await api.DELETE(request("DELETE", { id }, { "X-Account-Deletion-Token": token })))
                .status,
            200,
        );
        console.log(
            "PASS real resume handler rejects malformed/cross-origin/extra-target requests and requires a valid private receipt",
        );
        fs.writeFileSync(
            "verification/account-deletion-api.json",
            JSON.stringify(
                {
                    passed: true,
                    mode: "real route handlers, stubbed identity and cleanup dependencies",
                },
                null,
                2,
            ),
        );
    } catch (error) {
        console.error("FAIL", String(error.message).split("\n")[0]);
        process.exitCode = 1;
    }
})();
