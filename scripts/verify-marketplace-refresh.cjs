const fs = require("node:fs"),
    assert = require("node:assert/strict");
require("@next/env").loadEnvConfig(process.cwd());
const branch = fs.readFileSync(".env.migration-test", "utf8");
process.env.DATABASE_URL = branch.match(/^DATABASE_URL=(.+)$/m)[1].trim();
const owner = "marketplace-refresh-qa-" + crypto.randomUUID(),
    key = Buffer.alloc(32, 9);
Object.assign(process.env, {
    LAZADA_APP_KEY: "fixture-key",
    LAZADA_APP_SECRET: "fixture-secret",
    LAZADA_REDIRECT_URI: "https://fixture.example/api/marketplaces/lazada/callback",
    TIKTOK_SHOP_APP_KEY: "fixture-key",
    TIKTOK_SHOP_APP_SECRET: "fixture-secret",
    TIKTOK_SHOP_SERVICE_ID: "fixture-service",
    TIKTOK_SHOP_REDIRECT_URI: "https://fixture.example/api/marketplaces/tiktok/callback",
    MARKETPLACE_TOKEN_ENCRYPTION_KEY: key.toString("base64"),
});
require("esbuild").buildSync({
    entryPoints: ["lib/marketplace-connection.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
    outfile: ".next/marketplace-refresh-qa.mjs",
});
(async () => {
    const { neon } = require("@neondatabase/serverless"),
        sql = neon(process.env.DATABASE_URL),
        { marketplaceConfig, encryptMarketplaceTokens, decryptMarketplaceTokens } =
            await import("../lib/marketplace-api.mjs"),
        { connectedMarketplace } = await import("../.next/marketplace-refresh-qa.mjs");
    const realFetch = global.fetch;
    let release,
        started,
        calls = 0,
        subject;
    global.fetch = async (url, options) => {
        const host = new URL(url).hostname;
        if (!["auth.lazada.com", "auth.tiktok-shops.com"].includes(host))
            return realFetch(url, options);
        calls++;
        started?.();
        await new Promise((resolve) => {
            release = resolve;
        });
        const data = {
            access_token: "fixture-rotated-access",
            refresh_token: "fixture-rotated-refresh",
        };
        return host === "auth.lazada.com"
            ? Response.json({
                  code: "0",
                  ...data,
                  expires_in: 3600,
                  country_user_info: [{ country: "ph", seller_id: subject }],
              })
            : Response.json({
                  code: 0,
                  data: {
                      ...data,
                      user_type: 0,
                      open_id: subject,
                      access_token_expire_in: Math.floor(Date.now() / 1000) + 3600,
                  },
              });
    };
    async function seed(platform) {
        const config = marketplaceConfig(platform);
        subject = "seller-" + platform;
        const tokens = {
                accountId: subject,
                accessToken: "fixture-old-access",
                refreshToken: "fixture-old-refresh",
                expiresAt: new Date(Date.now() - 1000).toISOString(),
            },
            cipher = encryptMarketplaceTokens(tokens, key, owner, platform, subject);
        await sql`delete from seller_marketplace_connections where owner_id=${owner} and platform=${platform}`;
        await sql`insert into seller_marketplace_connections(owner_id,platform,connection_id,account_id,token_ciphertext,app_fingerprint,expires_at) values(${owner},${platform},${crypto.randomUUID()},${subject},${cipher},${config.fingerprint},${tokens.expiresAt})`;
    }
    try {
        for (const platform of ["lazada", "tiktok"]) {
            await seed(platform);
            let ready = new Promise((resolve) => {
                started = resolve;
            });
            const count = calls,
                pending = connectedMarketplace(owner, platform);
            await ready;
            await assert.rejects(() => connectedMarketplace(owner, platform), /refreshing/);
            release();
            const result = await pending;
            assert.equal(result.tokens.refreshToken, "fixture-rotated-refresh");
            assert.equal(calls, count + 1);
            const [row] =
                await sql`select token_ciphertext,refresh_locked_until from seller_marketplace_connections where owner_id=${owner} and platform=${platform}`;
            assert.equal(row.refresh_locked_until, null);
            assert.equal(row.token_ciphertext.includes("fixture-rotated"), false);
            assert.equal(
                decryptMarketplaceTokens(row.token_ciphertext, key, owner, platform, subject)
                    .refreshToken,
                "fixture-rotated-refresh",
            );
            await connectedMarketplace(owner, platform);
            assert.equal(calls, count + 1);
            console.log(
                "PASS",
                platform,
                "single refresh lease, encrypted token rotation and reuse",
            );
            await seed(platform);
            ready = new Promise((resolve) => {
                started = resolve;
            });
            const disconnected = connectedMarketplace(owner, platform);
            await ready;
            await sql`delete from seller_marketplace_connections where owner_id=${owner} and platform=${platform}`;
            release();
            await assert.rejects(() => disconnected, /connection changed/);
            assert.equal(
                (
                    await sql`select count(*)::int count from seller_marketplace_connections where owner_id=${owner} and platform=${platform}`
                )[0].count,
                0,
            );
            console.log("PASS", platform, "disconnect during refresh cannot recreate tokens");
        }
    } finally {
        release?.();
        global.fetch = realFetch;
        await sql`delete from seller_marketplace_connections where owner_id=${owner}`;
    }
})().catch((error) => {
    console.error("FAIL", error.message.split("\n")[0]);
    process.exitCode = 1;
});
