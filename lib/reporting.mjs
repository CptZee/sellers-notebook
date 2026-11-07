const day = 86400000;
const timestamp = (value) => Date.parse(value + "T00:00:00Z");
const iso = (value) => new Date(value).toISOString().slice(0, 10);
export function reportRange(period, today, dates = [], from = "", to = "") {
    const end = timestamp(today);
    if (period === "custom") {
        if (
            !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
            !/^\d{4}-\d{2}-\d{2}$/.test(to) ||
            !Number.isFinite(timestamp(from)) ||
            !Number.isFinite(timestamp(to)) ||
            iso(timestamp(from)) !== from ||
            iso(timestamp(to)) !== to ||
            from > to ||
            to > today
        )
            return {
                from: "",
                to: "",
                error: "Choose valid dates with the start before the end, up to today.",
            };
        return { from, to, error: "" };
    }
    if (period === "month") return { from: today.slice(0, 7) + "-01", to: today, error: "" };
    if (period === "all")
        return {
            from:
                dates
                    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today)
                    .sort()[0] || today,
            to: today,
            error: "",
        };
    const count = Number(period);
    if (![7, 30, 90].includes(count)) throw Error("Unsupported reporting period.");
    return { from: iso(end - (count - 1) * day), to: today, error: "" };
}
export function inReportRange(date, range) {
    return !range.error && date >= range.from && date <= range.to;
}
export function revenueBuckets(orders, range) {
    if (range.error) return [];
    const start = timestamp(range.from),
        end = timestamp(range.to),
        days = Math.round((end - start) / day) + 1;
    const size = Math.max(1, Math.ceil(days / 14)),
        count = Math.ceil(days / size);
    const buckets = Array.from({ length: count }, (_, index) => ({
        from: iso(start + index * size * day),
        to: iso(Math.min(end, start + ((index + 1) * size - 1) * day)),
        revenue: 0,
    }));
    const cents = Array(count).fill(0);
    for (const order of orders)
        if (order.status === "Completed" && inReportRange(order.date, range)) {
            const index = Math.floor((timestamp(order.date) - start) / day / size);
            cents[index] += Math.round(order.price * order.quantity * 100);
        }
    return buckets.map((bucket, index) => ({ ...bucket, revenue: cents[index] / 100 }));
}
