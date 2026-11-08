// Exercise real v1 dispatch and identity helpers with isolated database fixtures.
const assert = require("node:assert/strict");
const path = require("node:path");
(async () => {
    global.__apiFixture = { scope: "read", request_count: 1, owner_id: "owner-a" };
    global.__apiDeleting = false;
    await require("esbuild").build({
        entryPoints: ["app/api/v1/[...path]/route.ts"],
        outfile: ".next/public-api-test.cjs",
        bundle: true,
        platform: "node",
        format: "cjs",
        packages: "external",
        plugins: [
            {
                name: "fixtures",
                setup(build) {
                    const fixture = (filter, name, contents) => {
                        build.onResolve({ filter }, () => ({ path: name, namespace: name }));
                        build.onLoad({ filter: /.*/, namespace: name }, () => ({
                            contents,
                            loader: "js",
                            resolveDir: process.cwd(),
                        }));
                    };
                    fixture(
                        /lib\/db$|^\.\/db$/,
                        "database",
                        `export function database(){return {execute:async(query)=>({rows:String(query.queryChunks?.map(x=>x.value||'').join('')).includes('display_name')?[{display_name:'Owner A'}]:(global.__apiFixture?[global.__apiFixture]:[])})}}`,
                    );
                    fixture(
                        /account-lifecycle$/,
                        "lifecycle",
                        `export async function accountDeleting(){return global.__apiDeleting}`,
                    );
                    fixture(
                        /auth\/server$/,
                        "auth",
                        `export const auth={getSession:async()=>({data:{user:{id:'cookie-owner',name:'Cookie',email:'cookie@example.com'}}})}`,
                    );
                    fixture(
                        /notebook(?:\/[^/]+)?\/route$/,
                        "handlers",
                        `import {sessionUser,sameOrigin,json} from './lib/api'; export async function GET(request){return json({user:await sessionUser(request),cookie:request.headers.get('cookie'),hint:request.headers.get('x-notebook-user')})} export async function POST(request){return json({user:await sessionUser(request),allowed:sameOrigin(request)})} export const PUT=POST,PATCH=POST;`,
                    );
                },
            },
        ],
    });
    const api = require(path.resolve(".next/public-api-test.cjs"));
    const context = (resource = "notebook") => ({
        params: Promise.resolve({ path: resource.split("/") }),
    });
    const req = (method = "GET", authorization = `Bearer snb_${"a".repeat(64)}`) =>
        new Request("https://example.com/api/v1/notebook", {
            method,
            headers: {
                authorization,
                cookie: "session=other-account",
                "x-notebook-user": "attacker",
                origin: "https://third-party.example",
            },
        });
    assert.equal((await api.GET(req("GET", ""), context())).status, 401);
    assert.equal((await api.GET(req(), context("admin"))).status, 404);
    assert.equal((await api.POST(req("POST"), context())).status, 403);
    let response = await api.GET(req(), context());
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
    assert.deepEqual(await response.json(), {
        user: { id: "owner-a", name: "Owner A", email: "", image: null },
        cookie: null,
        hint: null,
    });
    global.__apiFixture.scope = "write";
    response = await api.POST(req("POST"), context());
    assert.equal(response.status, 200);
    assert.equal((await response.json()).allowed, true);
    global.__apiFixture.request_count = 61;
    response = await api.GET(req(), context());
    assert.equal(response.status, 429);
    assert.equal(response.headers.get("Retry-After"), "60");
    global.__apiFixture.request_count = 1;
    global.__apiDeleting = true;
    assert.equal((await api.GET(req(), context())).status, 401);
    global.__apiDeleting = false;
    global.__apiFixture = null;
    assert.equal((await api.GET(req(), context())).status, 401);
    assert.equal((await api.OPTIONS()).status, 204);
    console.log(
        "PASS public API authentication, account isolation, scopes, revocation, deletion barrier, CORS and rate-limit handling",
    );
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
