import { parseInventoryQuery } from "./inventory-query.mjs";
export const viewKinds = [
    "purchases",
    "reminders",
    "statements",
    "stock",
    "refunds",
    "payments",
    "supplier-refunds",
];
export function parseNotebookView(
    params,
    today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date()),
) {
    const base = parseInventoryQuery(params),
        kind = params.get("kind"),
        supplierId = params.get("supplierId") || "all",
        parent = params.get("parent") || "",
        id = params.get("id") || "";
    const financial = params.get("financial") || "";
    if (
        !["", "payment", "supplier-refund"].includes(financial) ||
        (financial && kind !== "statements")
    )
        throw Error("Invalid financial view.");
    const status =
        params.get("status") ||
        (kind === "purchases"
            ? "All purchases"
            : kind === "reminders"
              ? "All open"
              : "All statuses");
    const allowed =
        kind === "purchases"
            ? ["All purchases", "Ordered", "Partially received", "Overdue", "Received", "Cancelled"]
            : kind === "reminders"
              ? ["All open", "Overdue", "Due today", "Next 7 days", "Later", "No date set"]
              : ["All statuses", "Ordered", "Partially received", "Received", "Cancelled"];
    if (
        !viewKinds.includes(kind) ||
        !allowed.includes(status) ||
        [supplierId, parent, id].some((value) => value.length > 100)
    )
        throw Error("Invalid view filters.");
    return {
        ...base,
        kind,
        supplierId,
        parent,
        id,
        status,
        today,
        financial,
        search: ["reminders", "statements"].includes(kind) ? base.search.trim() : base.search,
    };
}
