import { createHash, createHmac } from "node:crypto";
import { sealTokens, openTokens } from "./shopee-api.mjs";

export const platforms = ["lazada", "tiktok"];
export const platformName = (p) => (p === "lazada" ? "Lazada" : "TikTok Shop");
export function marketplaceConfig(platform, env = process.env) {
    if (!platforms.includes(platform)) throw new Error("Unknown marketplace.");
    const prefix = platform === "lazada" ? "LAZADA" : "TIKTOK_SHOP";
    const appKey = env[`${prefix}_APP_KEY`]?.trim(),
        appSecret = env[`${prefix}_APP_SECRET`]?.trim();
    const redirectUri = env[`${prefix}_REDIRECT_URI`]?.trim(),
        serviceId = env.TIKTOK_SHOP_SERVICE_ID?.trim();
    const rawKey = env.MARKETPLACE_TOKEN_ENCRYPTION_KEY;
    try {
        const callback = new URL(redirectUri);
        const encryptionKey = Buffer.from(rawKey || "", "base64");
        if (
            !appKey ||
            !appSecret ||
            encryptionKey.length !== 32 ||
            callback.protocol !== "https:" ||
            callback.username ||
            callback.password ||
            callback.search ||
            callback.hash ||
            callback.pathname !== `/api/marketplaces/${platform}/callback` ||
            (platform === "tiktok" && !serviceId)
        )
            throw Error();
        const fingerprint = createHash("sha256")
            .update(
                JSON.stringify([
                    platform,
                    appKey,
                    redirectUri,
                    platform === "tiktok" ? serviceId : "",
                ]),
            )
            .digest("hex");
        return {
            ready: true,
            platform,
            appKey,
            appSecret,
            redirectUri: callback.href,
            serviceId,
            encryptionKey,
            fingerprint,
        };
    } catch {
        return { ready: false, platform };
    }
}
export function marketplaceAuthorizationUrl(config, state) {
    if (!config.ready) throw new Error("Connection is coming soon.");
    const url = new URL(
        config.platform === "lazada"
            ? "https://auth.lazada.com/oauth/authorize"
            : "https://services.tiktokshop.com/open/authorize",
    );
    url.searchParams.set("state", state);
    if (config.platform === "lazada") {
        url.searchParams.set("response_type", "code");
        url.searchParams.set("force_auth", "true");
        url.searchParams.set("client_id", config.appKey);
        url.searchParams.set("redirect_uri", config.redirectUri);
    } else url.searchParams.set("service_id", config.serviceId);
    return url.href;
}
export function signLazada(path, params, secret) {
    const content =
        path +
        Object.keys(params)
            .filter((k) => k !== "sign")
            .sort()
            .map((k) => k + String(params[k]))
            .join("");
    return createHmac("sha256", secret).update(content).digest("hex").toUpperCase();
}
export function encryptMarketplaceTokens(tokens, key, owner, platform, account) {
    return sealTokens(tokens, key, owner, JSON.stringify([platform, account]));
}
export function decryptMarketplaceTokens(value, key, owner, platform, account) {
    return openTokens(value, key, owner, JSON.stringify([platform, account]));
}
const fail = () =>
    new Error("The marketplace could not authorize this account. Please reconnect and try again.");
function text(value) {
    return typeof value === "string" && value.length > 0 && value.length <= 10000;
}
export function normalizeMarketplaceTokens(platform, result, now = Date.now()) {
    if (String(result?.code) !== "0") throw fail();
    const data = platform === "lazada" ? result : result.data;
    if (!data || !text(data.access_token) || !text(data.refresh_token)) throw fail();
    let accountId, expiresAt;
    if (platform === "lazada") {
        const store = data.country_user_info?.find((s) => s.country === "ph");
        if (
            data.account_platform !== "seller_center" ||
            !store ||
            !text(store.seller_id) ||
            !Number.isFinite(data.expires_in) ||
            data.expires_in <= 0 ||
            data.expires_in > 315360000
        )
            throw fail();
        accountId = store.seller_id;
        expiresAt = now + data.expires_in * 1000;
    } else {
        // Seller tokens only. Creator and partner tokens do not authorize seller shops.
        if (
            data.user_type !== 0 ||
            !text(data.open_id) ||
            !Number.isFinite(data.access_token_expire_in)
        )
            throw fail();
        accountId = data.open_id;
        expiresAt = data.access_token_expire_in * 1000;
    }
    if (!Number.isFinite(expiresAt) || expiresAt <= now || expiresAt > now + 315360000000)
        throw fail();
    return {
        accountId,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: new Date(expiresAt).toISOString(),
    };
}
export async function exchangeMarketplaceCode(
    config,
    code,
    { fetcher = fetch, now = Date.now() } = {},
) {
    if (!config.ready) throw fail();
    let url,
        options = { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) };
    if (config.platform === "lazada") {
        const path = "/auth/token/create";
        const params = {
            app_key: config.appKey,
            code,
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
        url = new URL("https://auth.tiktok-shops.com/api/v2/token/get");
        url.search = new URLSearchParams({
            app_key: config.appKey,
            app_secret: config.appSecret,
            auth_code: code,
            grant_type: "authorized_code",
        }).toString();
    }
    try {
        const response = await fetcher(url, options);
        if (!response.ok) throw fail();
        return normalizeMarketplaceTokens(config.platform, await response.json(), now);
    } catch {
        throw fail();
    }
}
