import { eligibleFinancialPurchases } from "./purchase-payments.mjs";
import {
    supplierStatement,
    supplierStatementCsv,
    supplierStatementHtml,
} from "./supplier-statements.mjs";
import { deliveryReminders, deliveryRemindersCsv } from "./delivery-reminders.mjs";
import { isPurchaseOverdue } from "./purchase-copy.mjs";
import { orderGroup } from "./order-copy.mjs";
const csv = (rows) =>
    "\uFEFF" +
    rows
        .map((row) =>
            row
                .map(
                    (value) =>
                        '"' +
                        (typeof value === "number"
                            ? String(value)
                            : String(value ?? "").replace(/^\s*[=+@-]/, "'$&")
                        ).replaceAll('"', '""') +
                        '"',
                )
                .join(","),
        )
        .join("\r\n");
export function notebookViewExport(document, filters, format = "csv") {
    const { kind, status, search, supplierId, parent, id, today } = filters;
    if (filters.financial)
        document = {
            ...document,
            purchaseOrders: eligibleFinancialPurchases(document.purchaseOrders, filters.financial),
        };
    if (!["csv", "html"].includes(format) || (format === "html" && kind !== "statements"))
        throw Error("Invalid download format.");
    if (kind === "statements") {
        const selected = { supplierId, status, search };
        return format === "html"
            ? {
                  body: supplierStatementHtml(
                      document.purchaseOrders,
                      selected,
                      document.suppliers,
                      document.branding,
                  ),
                  filename: "supplier-statement.html",
                  type: "text/html;charset=utf-8",
              }
            : {
                  body: supplierStatementCsv(
                      supplierStatement(document.purchaseOrders, selected).rows,
                  ),
                  filename: "supplier-statement.csv",
                  type: "text/csv;charset=utf-8",
              };
    }
    if (kind === "reminders")
        return {
            body: deliveryRemindersCsv(
                deliveryReminders(document.purchaseOrders, today, {
                    filter: status,
                    search,
                    supplierId,
                }),
            ),
            filename: `delivery-follow-up-${today}.csv`,
            type: "text/csv;charset=utf-8",
        };
    let rows, filename;
    if (kind === "purchases") {
        const orders = document.purchaseOrders.filter(
            (o) =>
                (!id || o.id === id) &&
                (supplierId === "all" || o.supplierId === supplierId) &&
                (status === "All purchases" ||
                    (status === "Overdue" ? isPurchaseOverdue(o, today) : o.status === status)) &&
                [o.reference, o.supplierName, ...o.items.map((i) => i.productName + " " + i.sku)]
                    .join(" ")
                    .toLowerCase()
                    .includes(search.toLowerCase()),
        );
        rows = [
            ["Purchase", "Supplier", "Status", "Created", "Expected delivery"],
            ...orders
                .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
                .map((o) => [o.reference, o.supplierName, o.status, o.createdAt, o.expectedDate]),
        ];
        filename = "purchase-orders.csv";
    } else {
        let records =
            kind === "stock"
                ? document.stockAdjustments
                : kind === "refunds"
                  ? document.refundRecords
                  : document.purchaseOrders.find((o) => o.id === parent)?.[
                        kind === "payments" ? "payments" : "supplierRefunds"
                    ] || [];
        if (parent && kind === "stock") records = records.filter((r) => r.productId === parent);
        if (parent && kind === "refunds") {
            const ids = new Set(orderGroup(document.orders, parent).map((o) => o.id));
            records = records.filter((r) => ids.has(r.orderId));
        }
        if (search)
            records = records.filter((r) =>
                JSON.stringify(r).toLowerCase().includes(search.toLowerCase()),
            );
        if (kind === "stock") {
            rows = [
                ["Date", "Product", "SKU", "Type", "Before", "After", "Change", "Reason"],
                ...records.map((r) => [
                    r.createdAt,
                    r.productName,
                    r.sku,
                    r.kind,
                    r.before,
                    r.after,
                    r.after - r.before,
                    r.reason,
                ]),
            ];
            filename = "stock-adjustment-history.csv";
        } else if (kind === "refunds") {
            rows = [
                ["Date", "Order line", "Amount (PHP)", "Reason"],
                ...records.map((r) => [r.date, r.orderId, r.amount.toFixed(2), r.reason]),
            ];
            filename = "customer-refund-history.csv";
        } else {
            rows = [
                ["Date", "Amount (PHP)", "Method", "Reference", "Private notes"],
                ...records.map((r) => [
                    r.date,
                    r.amount.toFixed(2),
                    r.method,
                    r.reference,
                    r.notes,
                ]),
            ];
            filename =
                kind === "payments"
                    ? "purchase-payment-history.csv"
                    : "supplier-refund-history.csv";
        }
    }
    return { body: csv(rows), filename, type: "text/csv;charset=utf-8" };
}
