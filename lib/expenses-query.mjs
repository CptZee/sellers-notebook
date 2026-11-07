import { parseInventoryQuery } from "./inventory-query.mjs";
import { parseReportQuery } from "./report-query.mjs";
import { expenseCategories } from "./expenses.mjs";
export function parseExpensesQuery(params, today) {
    const page = parseInventoryQuery(params),
        report = parseReportQuery(params, today),
        category = params.get("category") || "All categories";
    if (category !== "All categories" && !expenseCategories.includes(category))
        throw Error("Invalid expense category.");
    return { ...page, ...report, revision: page.revision, category };
}
