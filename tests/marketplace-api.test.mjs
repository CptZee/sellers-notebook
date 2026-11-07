import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
    marketplaceConfig,
    marketplaceAuthorizationUrl,
    signLazada,
    normalizeMarketplaceTokens,
    exchangeMarketplaceCode,
    encryptMarketplaceTokens,
    decryptMarketplaceTokens,
} from "../lib/marketplace-api.mjs";
const now = 1793865600000;
const env = {
    LAZADA_APP_KEY: "123",
    LAZADA_APP_SECRET: "private-lazada",
    LAZADA_REDIRECT_URI: "https://notebook.example/api/marketplaces/lazada/callback",
    TIKTOK_SHOP_APP_KEY: "key",
    TIKTOK_SHOP_APP_SECRET: "private-tiktok",
    TIKTOK_SHOP_SERVICE_ID: "service123",
    TIKTOK_SHOP_REDIRECT_URI: "https://notebook.example/api/marketplaces/tiktok/callback",
    MARKETPLACE_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
};
const lazadaResult = {
    code: "0",
    access_token: "secret-access",
    refresh_token: "secret-refresh",
    expires_in: 3600,
    account_platform: "seller_center",
    country_user_info: [{ country: "ph", seller_id: "1234567890123456789" }],
};
const tiktokResult = {
    code: 0,
    data: {
        access_token: "secret-access",
        refresh_token: "secret-refresh",
        open_id: "seller-open-id",
        user_type: 0,
        access_token_expire_in: now / 1000 + 3600,
    },
};
test("marketplace setup fails closed for missing credentials, invalid callbacks, and missing TikTok service ID", () => {
    for (const platform of ["lazada", "tiktok"]) {
        assert.equal(marketplaceConfig(platform, {}).ready, false);
        assert.equal(marketplaceConfig(platform, env).ready, true);
        const prefix = platform === "lazada" ? "LAZADA" : "TIKTOK_SHOP";
        for (const key of [
            `${prefix}_APP_KEY`,
            `${prefix}_APP_SECRET`,
            "MARKETPLACE_TOKEN_ENCRYPTION_KEY",
        ])
            assert.equal(marketplaceConfig(platform, { ...env, [key]: "" }).ready, false);
        for (const url of [
            "http://notebook.example/api/marketplaces/" + platform + "/callback",
            "https://notebook.example/wrong",
            "https://notebook.example/api/marketplaces/" + platform + "/callback?extra=1",
        ])
            assert.equal(
                marketplaceConfig(platform, { ...env, [`${prefix}_REDIRECT_URI`]: url }).ready,
                false,
            );
    }
    assert.equal(marketplaceConfig("tiktok", { ...env, TIKTOK_SHOP_SERVICE_ID: "" }).ready, false);
    assert.throws(() => marketplaceConfig("unknown", env));
});
test("authorization links use fixed seller endpoints, state, and no secrets", () => {
    const lazada = new URL(marketplaceAuthorizationUrl(marketplaceConfig("lazada", env), "nonce"));
    assert.equal(lazada.origin, "https://auth.lazada.com");
    assert.equal(lazada.searchParams.get("state"), "nonce");
    assert.equal(lazada.searchParams.get("redirect_uri"), env.LAZADA_REDIRECT_URI);
    const tiktok = new URL(marketplaceAuthorizationUrl(marketplaceConfig("tiktok", env), "nonce"));
    assert.equal(tiktok.origin, "https://services.tiktokshop.com");
    assert.equal(tiktok.searchParams.get("service_id"), "service123");
    assert.equal(tiktok.searchParams.get("state"), "nonce");
    for (const url of [lazada, tiktok]) assert.ok(!url.href.includes("private-"));
});
test("Lazada signing sorts parameters, includes API path, and omits existing signature", () => {
    assert.equal(
        signLazada(
            "/auth/token/create",
            { timestamp: "123", code: "abc", app_key: "456", sign: "ignore" },
            "key",
        ),
        createHmac("sha256", "key")
            .update("/auth/token/createapp_key456codeabctimestamp123")
            .digest("hex")
            .toUpperCase(),
    );
});
test("token normalization respects different expiry semantics and preserves large seller IDs", () => {
    for (const [platform, result] of [
        ["lazada", lazadaResult],
        ["tiktok", tiktokResult],
    ])
        assert.equal(
            normalizeMarketplaceTokens(platform, result, now).expiresAt,
            new Date(now + 3600000).toISOString(),
        );
    assert.equal(
        normalizeMarketplaceTokens("lazada", lazadaResult, now).accountId,
        "1234567890123456789",
    );
    assert.throws(() =>
        normalizeMarketplaceTokens(
            "tiktok",
            { ...tiktokResult, data: { ...tiktokResult.data, user_type: 1 } },
            now,
        ),
    );
    assert.throws(() =>
        normalizeMarketplaceTokens(
            "lazada",
            { ...lazadaResult, country_user_info: [{ country: "sg", seller_id: "1" }] },
            now,
        ),
    );
    assert.throws(() =>
        normalizeMarketplaceTokens(
            "tiktok",
            { ...tiktokResult, data: { ...tiktokResult.data, access_token_expire_in: 0 } },
            now,
        ),
    );
});
test("tokens are encrypted and bound to owner, platform, and account", () => {
    const tokens = normalizeMarketplaceTokens("lazada", lazadaResult, now),
        key = Buffer.alloc(32, 7);
    const cipher = encryptMarketplaceTokens(tokens, key, "owner", "lazada", "shop");
    assert.ok(!cipher.includes("secret-access"));
    assert.deepEqual(decryptMarketplaceTokens(cipher, key, "owner", "lazada", "shop"), tokens);
    for (const [owner, platform, shop] of [
        ["other", "lazada", "shop"],
        ["owner", "tiktok", "shop"],
        ["owner", "lazada", "other"],
    ])
        assert.throws(() => decryptMarketplaceTokens(cipher, key, owner, platform, shop));
});
test("code exchanges use provider-specific parameters and redact upstream errors", async () => {
    for (const platform of ["lazada", "tiktok"]) {
        const config = marketplaceConfig(platform, env);
        const tokens = await exchangeMarketplaceCode(config, "auth-code", {
            now,
            fetcher: async (url, options) => {
                assert.equal(options.redirect, "error");
                assert.equal(options.cache, "no-store");
                if (platform === "lazada") {
                    assert.equal(String(url), "https://auth.lazada.com/rest/auth/token/create");
                    assert.equal(new URLSearchParams(options.body).get("code"), "auth-code");
                    assert.equal(options.method, "POST");
                } else {
                    const parsed = new URL(url);
                    assert.equal(parsed.host, "auth.tiktok-shops.com");
                    assert.equal(parsed.searchParams.get("auth_code"), "auth-code");
                    assert.equal(parsed.searchParams.get("grant_type"), "authorized_code");
                }
                return Response.json(platform === "lazada" ? lazadaResult : tiktokResult);
            },
        });
        assert.equal(tokens.accessToken, "secret-access");
        await assert.rejects(
            () =>
                exchangeMarketplaceCode(config, "code", {
                    fetcher: async () => {
                        throw Error("leaked secret-access private-tiktok");
                    },
                }),
            (e) => !e.message.includes("secret-access") && !e.message.includes("private-tiktok"),
        );
        await assert.rejects(
            () =>
                exchangeMarketplaceCode(config, "code", {
                    fetcher: async () => Response.json({ code: 999, message: "secret-access" }),
                }),
            (e) => !e.message.includes("secret-access"),
        );
    }
});
