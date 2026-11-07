import { reportRange } from "./reporting.mjs";
export const reportChannels = ["All channels", "Shopee", "Lazada", "TikTok Shop", "Direct"];
export function parseReportQuery(
    params,
    today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date()),
) {
    const period = params.get("period") || "30",
        channel = params.get("channel") || "All channels",
        revision = params.get("revision");
    if (
        !reportChannels.includes(channel) ||
        !["7", "30", "90", "month", "all", "custom"].includes(period) ||
        (revision !== null &&
            (!/^(0|[1-9]\d*)$/.test(revision) || !Number.isSafeInteger(Number(revision))))
    )
        throw Error("Invalid report filters.");
    const range = reportRange(period, today, [], params.get("from") || "", params.get("to") || "");
    if (range.error) throw Error(range.error);
    return { period, channel, today, range, revision: revision === null ? null : Number(revision) };
}
