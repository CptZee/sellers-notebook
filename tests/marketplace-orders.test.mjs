import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
    marketplaceImportEnabled,
    marketplaceRange,
    signTikTok,
    refreshMarketplaceTokens,
    marketplaceOrderRows,
    fetchMarketplaceOrders,
} from "../lib/marketplace-orders.mjs";
const now = Date.parse("2026-11-06T12:00:00Z"),
    tokens = {
        accountId: "seller",
        accessToken: "PRIVATE-ACCESS",
        refreshToken: "PRIVATE-REFRESH",
        expiresAt: new Date(now + 3600000).toISOString(),
    },
    config = (p) => ({ ready: true, platform: p, appKey: "app", appSecret: "PRIVATE-SECRET" }),
    range = marketplaceRange("2026-11-05", "2026-11-06", now);
const lazada = {
    order_id: "90071992547409931234",
    created_at: "2026-11-05T23:30:00+08:00",
    currency: "PHP",
    items: [
        { sku: "MUG", paid_price: "10.25", status: "delivered" },
        { sku: "MUG", paid_price: "10.25", status: "delivered" },
    ],
};
const tiktok = {
    id: "90071992547409931234",
    create_time: Math.floor(now / 1000),
    status: "COMPLETED",
    payment: { currency: "PHP" },
    line_items: [{ seller_sku: "MUG", sale_price: "10.25" }],
};
test("direct imports default off and date ranges validate Manila dates, leap days, ordering and the 30-day cap", () => {
    for (const p of ["lazada", "tiktok"]) assert.equal(marketplaceImportEnabled(p, {}), false);
    assert.equal(marketplaceImportEnabled("lazada", { LAZADA_ORDER_IMPORT_ENABLED: "true" }), true);
    assert.equal(
        marketplaceImportEnabled("lazada", { LAZADA_ORDER_IMPORT_ENABLED: "TRUE" }),
        false,
    );
    assert.equal(
        marketplaceRange("2026-11-05", "2026-11-05", now).from,
        Date.parse("2026-11-04T16:00:00Z") / 1000,
    );
    for (const pair of [
        ["2026-02-30", "2026-03-01"],
        ["2026-11-07", "2026-11-08"],
        ["2026-10-01", "2026-11-05"],
        ["2026-11-05", "2026-11-04"],
    ])
        assert.throws(() => marketplaceRange(...pair, now));
});
test("TikTok signs exact JSON bytes and sorted decoded query values, excluding signature and access token", () => {
    assert.equal(
        signTikTok(
            "/orders",
            { b: "two", sign: "ignore", a: "one", access_token: "ignore" },
            '{"a":1}',
            "secret",
        ),
        createHmac("sha256", "secret").update('secret/ordersaonebtwo{"a":1}secret').digest("hex"),
    );
    assert.notEqual(
        signTikTok("/orders", { a: "one" }, '{"a":1}', "secret"),
        signTikTok("/orders", { a: "one" }, '{ "a":1}', "secret"),
    );
});
test("refresh rotates encrypted-token inputs using provider-specific expiry semantics and sanitizes errors", async () => {
    for (const platform of ["lazada", "tiktok"]) {
        const result = await refreshMarketplaceTokens(config(platform), tokens, {
            now,
            fetcher: async (url, options) => {
                assert.equal(options.redirect, "error");
                assert.equal(options.cache, "no-store");
                if (platform === "lazada") {
                    assert.equal(new URL(url).host, "auth.lazada.com");
                    assert.equal(
                        new URLSearchParams(options.body).get("refresh_token"),
                        "PRIVATE-REFRESH",
                    );
                    return Response.json({
                        code: "0",
                        access_token: "new-access",
                        refresh_token: "rotated",
                        expires_in: 3600,
                        country_user_info: [{ country: "ph", seller_id: "seller" }],
                    });
                }
                assert.equal(new URL(url).pathname, "/api/v2/token/refresh");
                assert.equal(new URL(url).searchParams.get("grant_type"), "refresh_token");
                return Response.json({
                    code: 0,
                    data: {
                        open_id: "seller",
                        user_type: 0,
                        access_token: "new-access",
                        refresh_token: "rotated",
                        access_token_expire_in: now / 1000 + 3600,
                    },
                });
            },
        });
        assert.equal(result.refreshToken, "rotated");
        assert.equal(result.expiresAt, new Date(now + 3600000).toISOString());
        for (const fetcher of [
            async () => {
                throw Error("PRIVATE-SECRET");
            },
            async () => Response.json({ code: 999, message: "PRIVATE-ACCESS" }),
        ])
            await assert.rejects(
                () => refreshMarketplaceTokens(config(platform), tokens, { fetcher, now }),
                (e) => !e.message.includes("PRIVATE"),
            );
    }
    await assert.rejects(() =>
        refreshMarketplaceTokens(config("tiktok"), tokens, {
            now,
            fetcher: async () =>
                Response.json({
                    code: 0,
                    data: {
                        open_id: "other",
                        access_token: "a",
                        access_token_expire_in: now / 1000 + 3600,
                    },
                }),
        }),
    );
});
test("normalizers consolidate physical units conservatively and reject mixed amounts, unsafe IDs and unverified currency", () => {
    const row = marketplaceOrderRows("lazada", [lazada])[0];
    assert.equal(row.Quantity, "2");
    assert.equal(row["Order ID"], lazada.order_id);
    assert.equal(row["Order Status"], "DELIVERED");
    assert.equal(row["Unit Price"], "10.25");
    assert.equal(marketplaceOrderRows("tiktok", [tiktok])[0]["Order Date"], "2026-11-06");
    for (const bad of [
        { ...lazada, order_id: 9007199254740992 },
        { ...lazada, currency: "USD" },
        { ...lazada, currency: undefined },
        { ...lazada, items: [{ sku: "MUG", paid_price: "10.123" }] },
        {
            ...lazada,
            items: [...lazada.items, { sku: "MUG", paid_price: "11.00", status: "delivered" }],
        },
        { ...lazada, created_at: "2026-11-05 23:30:00" },
    ])
        assert.throws(() => marketplaceOrderRows("lazada", [bad]));
});
test("Lazada bounded order/detail fetches use fixed PH endpoints and return preview rows only", async () => {
    const calls = [];
    const result = await fetchMarketplaceOrders(config("lazada"), tokens, range, {
        now,
        fetcher: async (url, options) => {
            const u = new URL(url);
            calls.push(u.pathname);
            assert.equal(u.origin, "https://api.lazada.com.ph");
            assert.equal(u.searchParams.get("access_token"), tokens.accessToken);
            assert.ok(u.searchParams.get("sign"));
            assert.equal(options.redirect, "error");
            return Response.json({
                code: "0",
                data: u.pathname.endsWith("/orders/get")
                    ? { orders: [lazada], countTotal: 1 }
                    : lazada.items,
            });
        },
    });
    assert.deepEqual(calls, ["/rest/orders/get", "/rest/order/items/get"]);
    assert.equal(result.rows[0].Quantity, "2");
    assert.ok(!JSON.stringify(result).includes("PRIVATE"));
});
test("TikTok discovers authorized PH shops, uses header tokens and paginates signed search bodies", async () => {
    let pages = 0;
    const result = await fetchMarketplaceOrders(config("tiktok"), tokens, range, {
        now,
        fetcher: async (url, options) => {
            const u = new URL(url);
            assert.equal(u.origin, "https://open-api.tiktokglobalshop.com");
            assert.equal(options.headers["x-tts-access-token"], tokens.accessToken);
            assert.equal(u.searchParams.has("access_token"), false);
            if (u.pathname.includes("authorization"))
                return Response.json({
                    code: 0,
                    data: {
                        shops: [
                            { id: "shop", cipher: "cipher", region: "PH", name: "Test shop" },
                            { id: "foreign", cipher: "not-owned-context", region: "US" },
                        ],
                    },
                });
            pages++;
            assert.equal(options.method, "POST");
            assert.equal(u.searchParams.get("shop_cipher"), "cipher");
            assert.equal(JSON.parse(options.body).create_time_ge, range.from);
            return Response.json({
                code: 0,
                data: {
                    orders: [{ ...tiktok, id: "order-" + pages }],
                    next_page_token: pages === 1 ? "next" : "",
                },
            });
        },
    });
    assert.equal(pages, 2);
    assert.equal(result.rows.length, 2);
    assert.equal(result.shopId, "shop");
});
test("multi-shop accounts require explicit verified selection and repeated cursors fail without partial results", async () => {
    const shops = [
            { id: "one", cipher: "c1", region: "PH" },
            { id: "two", cipher: "c2", region: "PH" },
        ],
        fetcher = async (url) =>
            new URL(url).pathname.includes("authorization")
                ? Response.json({ code: 0, data: { shops } })
                : Response.json({ code: 0, data: { orders: [tiktok], next_page_token: "same" } });
    const choices = await fetchMarketplaceOrders(config("tiktok"), tokens, range, { fetcher, now });
    assert.equal(choices.rows, null);
    assert.equal(choices.shops.length, 2);
    await assert.rejects(() =>
        fetchMarketplaceOrders(config("tiktok"), tokens, range, {
            fetcher,
            now,
            shopCipher: "foreign",
        }),
    );
    await assert.rejects(() =>
        fetchMarketplaceOrders(config("tiktok"), tokens, range, { fetcher, now, shopCipher: "c1" }),
    );
});
