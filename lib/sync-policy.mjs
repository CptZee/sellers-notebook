import { createHash, timingSafeEqual } from "node:crypto";
export function syncConfigured(env = process.env) {
    return (
        env.MARKETPLACE_SYNC_ENABLED === "true" &&
        typeof env.MARKETPLACE_SYNC_SECRET === "string" &&
        env.MARKETPLACE_SYNC_SECRET.length >= 32
    );
}
export function authorizedSyncWorker(header, env = process.env) {
    if (!syncConfigured(env) || typeof header !== "string") return false;
    const digest = (s) => createHash("sha256").update(s).digest();
    return timingSafeEqual(digest(header), digest("Bearer " + env.MARKETPLACE_SYNC_SECRET));
}
export function syncPreferences(value) {
    if (
        !value ||
        Object.keys(value).some(
            (k) =>
                !["action", "enabled", "intervalMinutes", "lookbackDays", "shopCipher"].includes(k),
        ) ||
        typeof value.enabled !== "boolean" ||
        ![60, 360, 1440].includes(value.intervalMinutes) ||
        !Number.isInteger(value.lookbackDays) ||
        value.lookbackDays < 1 ||
        value.lookbackDays > 7 ||
        (value.shopCipher !== undefined &&
            (typeof value.shopCipher !== "string" || value.shopCipher.length > 100))
    )
        throw Error("Choose an hourly, six-hourly or daily schedule and a lookback of 1–7 days.");
    return {
        enabled: value.enabled,
        intervalMinutes: value.intervalMinutes,
        lookbackDays: value.lookbackDays,
        shopCipher: value.shopCipher || null,
    };
}
export function syncFailure(error, attempt) {
    const transient =
        typeof error?.message === "string" &&
        /marketplace request failed|refreshing its authorization/.test(error.message);
    return {
        retry: transient && attempt < 3,
        delaySeconds: Math.min(300, 60 * 2 ** Math.max(0, attempt - 1)),
        message: transient
            ? "The provider could not be reached. Retry is bounded to three attempts."
            : "Could not prepare this batch. Check the shop connection, selected shop and supported PHP payload before retrying.",
    };
}
