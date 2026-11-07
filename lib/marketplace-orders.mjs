import { createHmac } from "node:crypto";
import { signLazada, platformName } from "./marketplace-api.mjs";
export class MarketplaceError extends Error {}
const fail = () =>
    new MarketplaceError("The marketplace request failed. Retry later or reconnect the shop.");
const payload = () =>
    new MarketplaceError(
        "The marketplace returned unsupported order data. Use CSV for now and review the integration before enabling live imports.",
    );
export function marketplaceImportEnabled(platform, env = process.env) {
    return (
        env[
            platform === "lazada"
                ? "LAZADA_ORDER_IMPORT_ENABLED"
                : "TIKTOK_SHOP_ORDER_IMPORT_ENABLED"
        ] === "true"
    );
}
export function signTikTok(path, params, body, secret) {
    return createHmac("sha256", secret)
        .update(
            secret +
                path +
                Object.keys(params)
                    .filter((k) => !["sign", "access_token"].includes(k))
                    .sort()
                    .map((k) => k + String(params[k]))
                    .join("") +
                (body || "") +
                secret,
        )
        .digest("hex");
}
export function marketplaceRange(from, to, now = Date.now()) {
    const valid = (s) =>
        typeof s === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(s) &&
        Number.isFinite(Date.parse(s)) &&
        new Date(s).toISOString().slice(0, 10) === s;
    if (!valid(from) || !valid(to)) throw new MarketplaceError("Choose valid start and end dates.");
    const start = Date.parse(from + "T00:00:00+08:00"),
        end = Math.min(Date.parse(to + "T23:59:59+08:00"), now);
    if (start > end || Date.parse(to) - Date.parse(from) > 29 * 86400000)
        throw new MarketplaceError("Choose a past date range of up to 30 days.");
    return { from: Math.floor(start / 1000), to: Math.floor(end / 1000) };
}
export async function refreshMarketplaceTokens(
    config,
    tokens,
    { fetcher = fetch, now = Date.now() } = {},
) {
    if (!config.ready) throw new MarketplaceError("Connection is coming soon.");
    try {
        let url,
            options = { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15000) };
        if (config.platform === "lazada") {
            const path = "/auth/token/refresh",
                params = {
                    app_key: config.appKey,
                    refresh_token: tokens.refreshToken,
                    sign_method: "sha256",
                    timestamp: String(now),
                };
            params.sign = signLazada(path, params, config.appSecret);
            url = "https://auth.lazada.com/rest" + path;
            options = {
                ...options,
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams(params).toString(),
            };
        } else {
            url = new URL("https://auth.tiktok-shops.com/api/v2/token/refresh");
            url.search = new URLSearchParams({
                app_key: config.appKey,
                app_secret: config.appSecret,
                refresh_token: tokens.refreshToken,
                grant_type: "refresh_token",
            }).toString();
        }
        const response = await fetcher(url, options);
        if (!response.ok) throw fail();
        const result = await response.json();
        if (String(result.code) !== "0") throw fail();
        const data = config.platform === "lazada" ? result : result.data;
        if (
            !data ||
            typeof data.access_token !== "string" ||
            !data.access_token ||
            data.access_token.length > 10000
        )
            throw fail();
        if (
            config.platform === "lazada" &&
            ((data.account_platform !== undefined && data.account_platform !== "seller_center") ||
                (data.country_user_info !== undefined &&
                    (!Array.isArray(data.country_user_info) ||
                        !data.country_user_info.some((s) => s.country === "ph"))))
        )
            throw fail();
        const account =
            config.platform === "lazada"
                ? data.country_user_info?.find((s) => s.country === "ph")?.seller_id
                : data.open_id;
        if (
            (account !== undefined && String(account) !== tokens.accountId) ||
            (config.platform === "tiktok" && data.user_type !== undefined && data.user_type !== 0)
        )
            throw fail();
        const expiry =
            config.platform === "lazada"
                ? now + data.expires_in * 1000
                : data.access_token_expire_in * 1000;
        const refresh = data.refresh_token ?? tokens.refreshToken;
        if (
            !Number.isFinite(expiry) ||
            expiry <= now + 60000 ||
            expiry > now + 315360000000 ||
            typeof refresh !== "string" ||
            !refresh ||
            refresh.length > 10000
        )
            throw fail();
        return {
            ...tokens,
            accessToken: data.access_token,
            refreshToken: refresh,
            expiresAt: new Date(expiry).toISOString(),
        };
    } catch {
        throw fail();
    }
}
function identity(value) {
    if (typeof value === "string" && value && value.length <= 100) return value;
    if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0)
        return String(value);
    throw payload();
}
function amount(value) {
    if (
        typeof value !== "string" ||
        !/^\d+(?:\.\d{1,2})?$/.test(value) ||
        Number(value) > 100000000
    )
        throw payload();
    return Number(value);
}
function date(value) {
    if (
        (typeof value === "number" && !Number.isSafeInteger(value)) ||
        (typeof value === "string" && !/(Z|[+-]\d{2}:?\d{2})$/.test(value))
    )
        throw payload();
    const ms = typeof value === "number" ? value * 1000 : Date.parse(value);
    if (!Number.isFinite(ms)) throw payload();
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date(ms));
}
export function marketplaceOrderRows(platform, orders) {
    const grouped = new Map();
    for (const order of orders) {
        const id = identity(platform === "lazada" ? order.order_id : order.id),
            items = platform === "lazada" ? order.items : order.line_items;
        if (!Array.isArray(items) || !items.length) throw payload();
        for (const item of items) {
            const sku = platform === "lazada" ? item.sku : item.seller_sku;
            if (typeof sku !== "string" || !sku.trim() || sku.length > 100) throw payload();
            const currency = item.currency ?? order.currency ?? order.payment?.currency;
            if (currency !== "PHP")
                throw new MarketplaceError(
                    "Only explicit PHP order amounts are supported. Use a PHP CSV until the shop payload is verified.",
                );
            const price = amount(platform === "lazada" ? item.paid_price : item.sale_price),
                quantity = item.quantity ?? 1;
            if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10000000)
                throw payload();
            const status = String(item.status ?? order.status ?? "").toUpperCase(),
                day = date(platform === "lazada" ? order.created_at : order.create_time),
                key = JSON.stringify([id, sku.trim().toLowerCase()]);
            const row = {
                "Order ID": id,
                "Seller SKU": sku.trim(),
                Quantity: String(quantity),
                "Unit Price": price.toFixed(2),
                "Order Date": day,
                "Order Status": status,
                "Buyer Username": `${platformName(platform)} buyer`,
                Currency: "PHP",
            };
            const previous = grouped.get(key);
            if (previous) {
                if (
                    previous["Unit Price"] !== row["Unit Price"] ||
                    previous["Order Status"] !== status ||
                    previous["Order Date"] !== day
                )
                    throw new MarketplaceError(
                        "One order/SKU has different prices or statuses. Review and consolidate a CSV instead.",
                    );
                const total = Number(previous.Quantity) + quantity;
                if (total > 10000000) throw payload();
                previous.Quantity = String(total);
            } else grouped.set(key, row);
            if (grouped.size > 1000)
                throw new MarketplaceError(
                    "More than 1,000 order lines were found. Choose a shorter range.",
                );
        }
    }
    return [...grouped.values()];
}
export async function fetchMarketplaceOrders(
    config,
    tokens,
    range,
    { fetcher = fetch, now = Date.now(), shopCipher } = {},
) {
    if (!config.ready) throw new MarketplaceError("Connection is coming soon.");
    if (
        !range ||
        !Number.isSafeInteger(range.from) ||
        !Number.isSafeInteger(range.to) ||
        range.from > range.to ||
        range.to - range.from > 30 * 86400
    )
        throw new MarketplaceError("Choose a range of up to 30 days.");
    const deadline = Date.now() + 45000;
    let requests = 0;
    async function call(path, params = {}, body) {
        if (++requests > 60 || Date.now() >= deadline)
            throw new MarketplaceError("This fetch is too large. Choose a shorter date range.");
        const options = {
            cache: "no-store",
            redirect: "error",
            signal: AbortSignal.timeout(Math.max(1, Math.min(15000, deadline - Date.now()))),
        };
        let url;
        if (config.platform === "lazada") {
            const query = {
                ...params,
                app_key: config.appKey,
                access_token: tokens.accessToken,
                timestamp: String(now),
                sign_method: "sha256",
            };
            query.sign = signLazada(path, query, config.appSecret);
            url = new URL("https://api.lazada.com.ph/rest" + path);
            url.search = new URLSearchParams(query).toString();
        } else {
            const query = {
                    ...params,
                    app_key: config.appKey,
                    timestamp: String(Math.floor(now / 1000)),
                },
                text = body === undefined ? "" : JSON.stringify(body);
            query.sign = signTikTok(path, query, text, config.appSecret);
            url = new URL("https://open-api.tiktokglobalshop.com" + path);
            url.search = new URLSearchParams(query).toString();
            options.headers = {
                "x-tts-access-token": tokens.accessToken,
                ...(text ? { "Content-Type": "application/json" } : {}),
            };
            if (text) {
                options.method = "POST";
                options.body = text;
            }
        }
        try {
            const response = await fetcher(url, options);
            if (!response.ok) throw fail();
            const result = await response.json();
            if (String(result.code) !== "0") throw fail();
            return result.data;
        } catch {
            throw fail();
        }
    }
    const orders = [],
        seen = new Set();
    if (config.platform === "lazada") {
        let offset = 0;
        while (true) {
            const page = await call("/orders/get", {
                created_after: new Date(range.from * 1000).toISOString(),
                created_before: new Date(range.to * 1000).toISOString(),
                limit: "20",
                offset: String(offset),
                sort_by: "created_at",
                sort_direction: "ASC",
            });
            if (!page || !Array.isArray(page.orders)) throw payload();
            for (const order of page.orders) {
                const id = identity(order.order_id);
                if (seen.has(id))
                    throw new MarketplaceError(
                        "The marketplace repeated an order page. Retry a shorter range.",
                    );
                seen.add(id);
                const items = await call("/order/items/get", { order_id: id });
                if (!Array.isArray(items)) throw payload();
                orders.push({ ...order, items });
                if (orders.length > 1000)
                    throw new MarketplaceError("Too many orders. Choose a shorter range.");
            }
            offset += page.orders.length;
            if (!page.orders.length || offset >= Number(page.countTotal)) break;
            if (page.orders.length < 20 && page.countTotal === undefined) break;
        }
        return { rows: marketplaceOrderRows("lazada", orders) };
    }
    const authorized = await call("/authorization/202309/shops");
    if (!Array.isArray(authorized?.shops)) throw payload();
    const shops = authorized.shops
        .filter((s) => s.region === "PH")
        .map((s) => ({
            id: identity(s.id),
            name: String(s.name || "Philippines shop").slice(0, 200),
            cipher: identity(s.cipher),
        }));
    const selected = shopCipher
        ? shops.find((s) => s.cipher === shopCipher)
        : shops.length === 1
          ? shops[0]
          : null;
    if (!selected) {
        if (shopCipher || !shops.length)
            throw new MarketplaceError("Choose a Philippines shop authorized by this account.");
        return { shops, rows: null };
    }
    let cursor = "";
    const cursors = new Set();
    do {
        const page = await call(
            "/order/202309/orders/search",
            {
                shop_cipher: selected.cipher,
                page_size: "20",
                sort_order: "ASC",
                sort_field: "create_time",
                ...(cursor ? { page_token: cursor } : {}),
            },
            { create_time_ge: range.from, create_time_lt: range.to + 1 },
        );
        if (!page || !Array.isArray(page.orders)) throw payload();
        for (const order of page.orders) {
            const id = identity(order.id);
            if (seen.has(id)) throw payload();
            seen.add(id);
            orders.push(order);
            if (orders.length > 1000)
                throw new MarketplaceError("Too many orders. Choose a shorter range.");
        }
        cursor = page.next_page_token || "";
        if (typeof cursor !== "string" || cursor.length > 10000 || (cursor && cursors.has(cursor)))
            throw payload();
        cursors.add(cursor);
    } while (cursor);
    return { shopId: selected.id, shops, rows: marketplaceOrderRows("tiktok", orders) };
}
