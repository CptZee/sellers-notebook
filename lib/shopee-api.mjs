import { createHmac, createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

const hosts = {
    production: "https://partner.shopeemobile.com",
    sandbox: "https://partner.test-stable.shopeemobile.com",
};
export class ShopeeError extends Error {}
export function shopeeConfig(env = process.env) {
    const missing = [
        "SHOPEE_PARTNER_ID",
        "SHOPEE_PARTNER_KEY",
        "SHOPEE_REDIRECT_URI",
        "SHOPEE_TOKEN_ENCRYPTION_KEY",
    ].filter((key) => !env[key]);
    const environment = env.SHOPEE_ENVIRONMENT || "sandbox";
    if (missing.length) return { ready: false, missing, environment };
    try {
        const redirect = new URL(env.SHOPEE_REDIRECT_URI);
        if (
            !hosts[environment] ||
            !/^\d+$/.test(env.SHOPEE_PARTNER_ID) ||
            !Number.isSafeInteger(Number(env.SHOPEE_PARTNER_ID)) ||
            Number(env.SHOPEE_PARTNER_ID) < 1
        )
            throw Error();
        const local = ["127.0.0.1", "localhost"].includes(redirect.hostname);
        if (
            redirect.pathname !== "/api/shopee/callback" ||
            redirect.search ||
            redirect.hash ||
            redirect.username ||
            redirect.password ||
            (redirect.protocol !== "https:" &&
                !(environment === "sandbox" && local && redirect.protocol === "http:"))
        )
            throw Error();
        const key = Buffer.from(env.SHOPEE_TOKEN_ENCRYPTION_KEY, "base64");
        if (key.length !== 32) throw Error();
        return {
            ready: true,
            missing: [],
            environment,
            host: hosts[environment],
            partnerId: env.SHOPEE_PARTNER_ID,
            partnerKey: env.SHOPEE_PARTNER_KEY,
            redirectUri: redirect.href,
            encryptionKey: key,
        };
    } catch {
        return { ready: false, missing: ["Valid Shopee app configuration"], environment };
    }
}
export function stateHash(state) {
    return createHash("sha256").update(state).digest("hex");
}
export function signShopee(partnerId, partnerKey, path, timestamp, accessToken = "", shopId = "") {
    return createHmac("sha256", partnerKey)
        .update(`${partnerId}${path}${timestamp}${accessToken}${shopId}`)
        .digest("hex");
}
export function sealTokens(tokens, key, ownerId, shopId) {
    const iv = randomBytes(12),
        cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(Buffer.from(JSON.stringify([ownerId, shopId])));
    const body = Buffer.concat([cipher.update(JSON.stringify(tokens), "utf8"), cipher.final()]);
    return [
        "v1",
        iv.toString("base64url"),
        cipher.getAuthTag().toString("base64url"),
        body.toString("base64url"),
    ].join(".");
}
export function openTokens(encoded, key, ownerId, shopId) {
    const [version, iv, tag, body] = encoded.split(".");
    if (version !== "v1" || !iv || !tag || !body)
        throw new ShopeeError("Reconnect your Shopee shop.");
    try {
        const cipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
        cipher.setAAD(Buffer.from(JSON.stringify([ownerId, shopId])));
        cipher.setAuthTag(Buffer.from(tag, "base64url"));
        return JSON.parse(
            Buffer.concat([cipher.update(Buffer.from(body, "base64url")), cipher.final()]).toString(
                "utf8",
            ),
        );
    } catch {
        throw new ShopeeError("Reconnect your Shopee shop.");
    }
}
export function authorizationUrl(config, state, now = Math.floor(Date.now() / 1000)) {
    const path = "/api/v2/shop/auth_partner",
        url = new URL(path, config.host),
        callback = new URL(config.redirectUri);
    callback.searchParams.set("state", state);
    url.search = new URLSearchParams({
        partner_id: config.partnerId,
        timestamp: String(now),
        sign: signShopee(config.partnerId, config.partnerKey, path, now),
        redirect: callback.href,
    }).toString();
    return url.href;
}
export async function shopeeRequest(
    config,
    path,
    { method = "GET", params = {}, body, accessToken = "", shopId = "", fetcher = fetch } = {},
) {
    const timestamp = Math.floor(Date.now() / 1000),
        url = new URL(path, config.host);
    url.search = new URLSearchParams({
        partner_id: config.partnerId,
        timestamp: String(timestamp),
        sign: signShopee(config.partnerId, config.partnerKey, path, timestamp, accessToken, shopId),
        ...(accessToken ? { access_token: accessToken, shop_id: shopId } : {}),
        ...params,
    }).toString();
    try {
        const response = await fetcher(url, {
            method,
            cache: "no-store",
            redirect: "error",
            signal: AbortSignal.timeout(15000),
            headers: { "Content-Type": "application/json" },
            ...(body ? { body: JSON.stringify(body) } : {}),
        });
        if (!response.ok)
            throw new ShopeeError(
                "Shopee is unavailable or declined this request. Try again or reconnect.",
            );
        const data = await response.json();
        if (data.error)
            throw new ShopeeError(
                "Shopee declined the request. Check app permissions or reconnect your shop.",
            );
        return data;
    } catch (error) {
        if (error instanceof ShopeeError) throw error;
        throw new ShopeeError("Could not reach Shopee. Please try again.");
    }
}
export async function exchangeCode(config, code, shopId, fetcher = fetch) {
    return tokenResult(
        await shopeeRequest(config, "/api/v2/auth/token/get", {
            method: "POST",
            body: { code, shop_id: Number(shopId), partner_id: Number(config.partnerId) },
            fetcher,
        }),
    );
}
export async function refreshTokens(config, refreshToken, shopId, fetcher = fetch) {
    return tokenResult(
        await shopeeRequest(config, "/api/v2/auth/access_token/get", {
            method: "POST",
            body: {
                refresh_token: refreshToken,
                shop_id: Number(shopId),
                partner_id: Number(config.partnerId),
            },
            fetcher,
        }),
    );
}
function tokenResult(data) {
    if (
        typeof data.access_token !== "string" ||
        !data.access_token ||
        typeof data.refresh_token !== "string" ||
        !data.refresh_token ||
        !Number.isFinite(data.expire_in) ||
        data.expire_in <= 0
    )
        throw new ShopeeError("Shopee did not return valid shop credentials. Reconnect your shop.");
    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: new Date(Date.now() + data.expire_in * 1000).toISOString(),
    };
}
export function orderRows(details) {
    const rows = [];
    for (const order of details) {
        if (
            !order.order_sn ||
            !Array.isArray(order.item_list) ||
            !order.item_list.length ||
            order.currency !== "PHP" ||
            !Number.isFinite(order.create_time) ||
            order.create_time <= 0
        )
            throw new ShopeeError(
                "An order has missing details or a non-PHP currency. Review it in Shopee.",
            );
        const parts = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Manila",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).formatToParts(new Date(order.create_time * 1000));
        const part = (type) => parts.find((p) => p.type === type)?.value;
        const date = `${part("year")}-${part("month")}-${part("day")}`;
        for (const item of order.item_list)
            rows.push({
                "Order ID": String(order.order_sn),
                "Seller SKU": String(item.model_sku || item.item_sku || ""),
                Quantity: String(item.model_quantity_purchased ?? ""),
                "Unit Price": String(
                    item.model_discounted_price ?? item.model_original_price ?? "",
                ),
                "Order Date": date,
                "Order Status": String(order.order_status || ""),
                "Buyer Username": String(order.buyer_username || "Shopee buyer"),
                Currency: "PHP",
            });
    }
    if (rows.length > 1000)
        throw new ShopeeError(
            "More than 1,000 item lines were found. Choose a smaller date range.",
        );
    return rows;
}
export async function fetchOrderRows(config, accessToken, shopId, from, to, fetcher = fetch) {
    if (
        !Number.isInteger(from) ||
        !Number.isInteger(to) ||
        from >= to ||
        to - from > 14 * 86400 ||
        to > Math.floor(Date.now() / 1000) + 60
    )
        throw new ShopeeError(
            "Choose a date range of no more than 14 days, ending today or earlier.",
        );
    const ids = new Set(),
        cursors = new Set();
    let cursor = "";
    for (let page = 0; page < 5; page++) {
        const result = await shopeeRequest(config, "/api/v2/order/get_order_list", {
            accessToken,
            shopId,
            params: {
                time_range_field: "update_time",
                time_from: String(from),
                time_to: String(to),
                page_size: "50",
                ...(cursor ? { cursor } : {}),
            },
            fetcher,
        });
        const response = result.response;
        if (!response || !Array.isArray(response.order_list))
            throw new ShopeeError("Shopee returned an incomplete order list. Please retry.");
        for (const order of response.order_list) {
            if (typeof order.order_sn !== "string" || !order.order_sn)
                throw new ShopeeError("Shopee returned an incomplete order list.");
            ids.add(order.order_sn);
        }
        if (ids.size > 200)
            throw new ShopeeError("More than 200 orders were found. Choose a smaller date range.");
        if (!response.more) break;
        if (!response.next_cursor || cursors.has(response.next_cursor) || page === 4)
            throw new ShopeeError("Could not retrieve every order. Choose a smaller date range.");
        cursor = response.next_cursor;
        cursors.add(cursor);
    }
    const list = [...ids],
        details = [];
    for (let offset = 0; offset < list.length; offset += 50) {
        const requested = list.slice(offset, offset + 50);
        const result = await shopeeRequest(config, "/api/v2/order/get_order_detail", {
            accessToken,
            shopId,
            params: {
                order_sn_list: requested.join(","),
                response_optional_fields: "item_list,buyer_username",
            },
            fetcher,
        });
        const batch = result.response?.order_list;
        if (!Array.isArray(batch) || requested.some((id) => !batch.some((o) => o.order_sn === id)))
            throw new ShopeeError("Some order details could not be loaded. Please retry.");
        details.push(...batch.filter((o) => requested.includes(o.order_sn)));
    }
    return orderRows(details);
}
