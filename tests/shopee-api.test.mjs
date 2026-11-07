import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
    shopeeConfig,
    signShopee,
    sealTokens,
    openTokens,
    authorizationUrl,
    exchangeCode,
    refreshTokens,
    fetchOrderRows,
    orderRows,
    stateHash,
    ShopeeError,
} from "../lib/shopee-api.mjs";

const config = () =>
    shopeeConfig({
        SHOPEE_ENVIRONMENT: "sandbox",
        SHOPEE_PARTNER_ID: "10090",
        SHOPEE_PARTNER_KEY: "fixture-partner-key",
        SHOPEE_REDIRECT_URI: "http://127.0.0.1:3000/api/shopee/callback",
        SHOPEE_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
    });
const detail = {
    order_sn: "ORDER-1",
    currency: "PHP",
    create_time: Date.parse("2026-11-04T18:00:00Z") / 1000,
    order_status: "COMPLETED",
    buyer_username: "Buyer",
    item_list: [
        {
            item_sku: "BASE",
            model_sku: "MUG-1",
            model_quantity_purchased: 2,
            model_discounted_price: 300,
            model_original_price: 400,
        },
    ],
};
const response = (data) =>
    new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });

test("missing credentials disable connection and production callbacks require HTTPS", () => {
    assert.equal(shopeeConfig({}).ready, false);
    const env = {
        SHOPEE_ENVIRONMENT: "production",
        SHOPEE_PARTNER_ID: "1",
        SHOPEE_PARTNER_KEY: "fixture",
        SHOPEE_REDIRECT_URI: "http://127.0.0.1:3000/api/shopee/callback",
        SHOPEE_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
    };
    assert.equal(shopeeConfig(env).ready, false);
    assert.equal(
        shopeeConfig({
            ...env,
            SHOPEE_REDIRECT_URI: "https://notebook.example/api/shopee/callback",
        }).ready,
        true,
    );
    assert.equal(
        shopeeConfig({ ...env, SHOPEE_ENVIRONMENT: "https://untrusted.example" }).ready,
        false,
    );
});
test("shop API signature matches a fixed HMAC fixture", () => {
    assert.equal(
        signShopee(
            "10090",
            "fixture-partner-key",
            "/api/v2/order/get_order_list",
            1594897040,
            "fixture-access-token",
            "12345",
        ),
        "240575ed66753f89e6673fa25903d17202daf9360186ccae0e3d1150e30ab653",
    );
});
test("authorization URL binds a nonce into the callback without exposing the partner key", () => {
    const url = new URL(authorizationUrl(config(), "nonce-fixture", 1594897040));
    assert.equal(url.hostname, "partner.test-stable.shopeemobile.com");
    assert.equal(
        new URL(url.searchParams.get("redirect")).searchParams.get("state"),
        "nonce-fixture",
    );
    assert.ok(!url.href.includes("fixture-partner-key"));
    assert.equal(stateHash("nonce-fixture").length, 64);
});
test("tokens are authenticated-encrypted and bound to both account and shop", () => {
    const key = randomBytes(32),
        tokens = {
            accessToken: "fixture-sensitive-access",
            refreshToken: "fixture-sensitive-refresh",
            expiresAt: "2026-11-05T12:00:00Z",
        };
    const encrypted = sealTokens(tokens, key, "owner-a", "shop-a");
    assert.deepEqual(openTokens(encrypted, key, "owner-a", "shop-a"), tokens);
    assert.ok(!encrypted.includes(tokens.accessToken));
    assert.throws(() => openTokens(encrypted, key, "owner-b", "shop-a"));
    assert.throws(() => openTokens(encrypted, key, "owner-a", "shop-b"));
    assert.throws(() => openTokens(encrypted, randomBytes(32), "owner-a", "shop-a"));
    const parts = encrypted.split(".");
    parts[3] = (parts[3][0] === "A" ? "B" : "A") + parts[3].slice(1);
    assert.throws(() => openTokens(parts.join("."), key, "owner-a", "shop-a"));
});
test("token exchange and refresh use distinct signed POST paths and retain rotated credentials", async () => {
    const paths = [];
    const fetcher = async (url, options) => {
        paths.push(new URL(url).pathname);
        const body = JSON.parse(options.body);
        assert.equal(body.shop_id, 12345);
        assert.equal(body.partner_id, 10090);
        return response({
            access_token: "new-access",
            refresh_token: "new-refresh",
            expire_in: 14400,
        });
    };
    const initial = await exchangeCode(config(), "one-time-code", "12345", fetcher);
    const updated = await refreshTokens(config(), initial.refreshToken, "12345", fetcher);
    assert.equal(updated.refreshToken, "new-refresh");
    assert.deepEqual(paths, ["/api/v2/auth/token/get", "/api/v2/auth/access_token/get"]);
});
test("paginated order listing retrieves every detail batch before building preview rows", async () => {
    let calls = 0;
    const fetcher = async (url) => {
        calls++;
        const u = new URL(url);
        assert.equal(u.searchParams.get("shop_id"), "12345");
        if (u.pathname.endsWith("get_order_list"))
            return response({ response: { order_list: [{ order_sn: "ORDER-1" }], more: false } });
        return response({ response: { order_list: [detail] } });
    };
    const to = Math.floor(Date.now() / 1000),
        rows = await fetchOrderRows(config(), "fixture-access", "12345", to - 86400, to, fetcher);
    assert.equal(calls, 2);
    assert.equal(rows[0]["Seller SKU"], "MUG-1");
    assert.equal(rows[0]["Order Date"], "2026-11-05");
    assert.equal(rows[0]["Unit Price"], "300");
});
test("repeated pagination cursors are rejected rather than importing a partial list", async () => {
    const to = Math.floor(Date.now() / 1000),
        fetcher = async () =>
            response({
                response: {
                    order_list: [{ order_sn: "ORDER-1" }],
                    more: true,
                    next_cursor: "same",
                },
            });
    await assert.rejects(
        fetchOrderRows(config(), "fixture", "12345", to - 86400, to, fetcher),
        /every order/,
    );
});
test("a missing detail response and non-PHP orders cannot silently import", async () => {
    const to = Math.floor(Date.now() / 1000),
        fetcher = async (url) =>
            new URL(url).pathname.endsWith("get_order_list")
                ? response({ response: { order_list: [{ order_sn: "ORDER-1" }], more: false } })
                : response({ response: { order_list: [] } });
    await assert.rejects(
        fetchOrderRows(config(), "fixture", "12345", to - 86400, to, fetcher),
        /details/,
    );
    assert.throws(() => orderRows([{ ...detail, currency: "USD" }]), /non-PHP/);
});
test("zero-priced items remain zero and oversized date ranges make no provider request", async () => {
    assert.equal(
        orderRows([
            { ...detail, item_list: [{ ...detail.item_list[0], model_discounted_price: 0 }] },
        ])[0]["Unit Price"],
        "0",
    );
    const to = Math.floor(Date.now() / 1000);
    let called = false;
    await assert.rejects(
        fetchOrderRows(config(), "fixture", "12345", to - 15 * 86400, to, async () => {
            called = true;
            return response({});
        }),
        /14 days/,
    );
    assert.equal(called, false);
});
test("provider errors do not leak access tokens or raw upstream errors", async () => {
    const to = Math.floor(Date.now() / 1000);
    await assert.rejects(
        fetchOrderRows(config(), "sensitive-token", "12345", to - 86400, to, async () =>
            response({ error: "bad_sign", message: "sensitive-token" }),
        ),
        (error) => error instanceof ShopeeError && !error.message.includes("sensitive-token"),
    );
});
