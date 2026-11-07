import { parseInventoryQuery } from "./inventory-query.mjs";
import { parseReportQuery } from "./report-query.mjs";
export function parseOrdersQuery(params, today) {
    const page = parseInventoryQuery(params),
        report = parseReportQuery(params, today),
        status = params.get("status") || "All statuses",
        sort = params.get("sort") || "newest";
    if (
        !["All statuses", "Processing", "Completed", "Cancelled"].includes(status) ||
        !["newest", "oldest", "value"].includes(sort)
    )
        throw Error("Invalid order filters.");
    return {
        ...page,
        ...report,
        revision: page.revision,
        status,
        sort,
        search: page.search.trim(),
    };
}
