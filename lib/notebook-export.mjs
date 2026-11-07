import { filterSuppliers } from "./supplier-list.mjs";
import { filterOrderList } from "./order-management.mjs";
import { reportRange, inReportRange } from "./reporting.mjs";
import { orderTotals } from "./finance.mjs";
import { stockTargets } from "./restock-plan.mjs";
import { expenseCategories } from "./expenses.mjs";
import { parseReportQuery } from "./report-query.mjs";
export function notebookExport(document, params, today) {
    const kind = params.get("kind"),
        search = params.get("search") || "";
    if (!["inventory", "orders", "expenses", "suppliers"].includes(kind) || search.length > 200)
        throw Error("Invalid export filters.");
    let rows, filename;
    if (kind === "inventory") {
        rows = [
            [
                "Product name",
                "SKU",
                "Unit cost",
                "Selling price",
                "Stock",
                "Category",
                "Currency",
                "Reorder point",
                "Target stock",
            ],
            ...document.products
                .filter((p) => (p.name + " " + p.sku).toLowerCase().includes(search.toLowerCase()))
                .map((p) => [
                    p.name,
                    p.sku,
                    p.cost,
                    p.price,
                    p.stock,
                    p.category,
                    "PHP",
                    stockTargets(p).reorderPoint,
                    stockTargets(p).targetStock,
                ]),
        ];
        filename = "inventory-products.csv";
    } else if (kind === "suppliers") {
        rows = [
            [
                "Supplier",
                "Contact person",
                "Email",
                "Phone",
                "Address",
                "Lead time (days)",
                "Product SKUs",
                "Notes",
            ],
            ...filterSuppliers(document.suppliers, document.products, search).map((s) => [
                s.name,
                s.contact,
                s.email,
                s.phone,
                s.address,
                s.leadTimeDays,
                document.products
                    .filter((p) => s.productIds.includes(p.id))
                    .map((p) => p.sku)
                    .join("; "),
                s.notes,
            ]),
        ];
        filename = "notebook-suppliers.csv";
    } else {
        const filters = parseReportQuery(params, today),
            range = reportRange(
                filters.period,
                filters.today,
                [...document.orders, ...document.expenses, ...document.refundRecords].map(
                    (row) => row.date,
                ),
                filters.range.from,
                filters.range.to,
            );
        if (kind === "orders") {
            const status = params.get("status") || "All statuses",
                sort = params.get("sort") || "newest";
            if (
                !["All statuses", "Processing", "Completed", "Cancelled"].includes(status) ||
                !["newest", "oldest", "value"].includes(sort)
            )
                throw Error("Invalid order export filters.");
            const selected = filterOrderList(
                document.orders.filter(
                    (o) =>
                        inReportRange(o.date, range) &&
                        (filters.channel === "All channels" || o.channel === filters.channel),
                ),
                document.products,
                search,
                status,
                sort,
            );
            rows = [
                [
                    "Order",
                    "Customer",
                    "Product",
                    "Channel",
                    "Quantity",
                    "Revenue",
                    "Profit",
                    "Status",
                    "Date",
                ],
                ...selected.map((o) => [
                    o.sourceOrderId || o.id,
                    o.customer,
                    o.productName,
                    o.channel,
                    o.quantity,
                    orderTotals(o).revenue,
                    orderTotals(o).profit.toFixed(2),
                    o.status,
                    o.date,
                ]),
            ];
            filename = "sellers-notebook-orders.csv";
        } else {
            const category = params.get("category") || "All categories";
            if (category !== "All categories" && !expenseCategories.includes(category))
                throw Error("Invalid expense category.");
            const selected = document.expenses
                .filter(
                    (e) =>
                        inReportRange(e.date, range) &&
                        (filters.channel === "All channels" || e.channel === filters.channel) &&
                        (category === "All categories" || e.category === category) &&
                        (e.title + " " + e.notes).toLowerCase().includes(search.toLowerCase()),
                )
                .toSorted((a, b) => b.date.localeCompare(a.date));
            rows = [
                ["Date", "Title", "Category", "Channel", "Amount (PHP)", "Notes"],
                ...selected.map((e) => [
                    e.date,
                    e.title,
                    e.category,
                    e.channel,
                    e.amount.toFixed(2),
                    e.notes,
                ]),
            ];
            filename = "sellers-notebook-expenses.csv";
        }
    }
    return {
        filename,
        csv:
            "\uFEFF" +
            rows
                .map((row) =>
                    row
                        .map(
                            (cell) =>
                                '"' +
                                String(cell)
                                    .replace(/^\s*[=+@-]/, "'$&")
                                    .replaceAll('"', '""') +
                                '"',
                        )
                        .join(","),
                )
                .join("\r\n"),
    };
}
