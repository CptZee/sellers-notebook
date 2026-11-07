import { receivedUnits, purchaseProgress } from "./purchases.mjs";
const active = (order) => ["Ordered", "Partially received"].includes(order.status);
export function deliveryCategory(order, today) {
    if (!active(order)) return "Closed";
    if (!order.expectedDate) return "No date set";
    const days = Math.round(
        (Date.parse(order.expectedDate + "T12:00:00Z") - Date.parse(today + "T12:00:00Z")) /
            86400000,
    );
    return days < 0 ? "Overdue" : days === 0 ? "Due today" : days <= 7 ? "Next 7 days" : "Later";
}
export function deliveryCounts(orders, today) {
    const counts = { Overdue: 0, "Due today": 0, "Next 7 days": 0, Later: 0, "No date set": 0 };
    for (const order of orders) {
        const category = deliveryCategory(order, today);
        if (category !== "Closed") counts[category]++;
    }
    return counts;
}
export function deliveryReminders(
    orders,
    today,
    { filter = "All open", search = "", supplierId = "all" } = {},
) {
    const query = search.trim().toLowerCase();
    return orders
        .filter(
            (order) =>
                active(order) &&
                (supplierId === "all" || order.supplierId === supplierId) &&
                (filter === "All open" || deliveryCategory(order, today) === filter) &&
                [
                    order.reference,
                    order.supplierName,
                    ...order.items.map((item) => item.productName + " " + item.sku),
                ]
                    .join(" ")
                    .toLowerCase()
                    .includes(query),
        )
        .map((order) => ({
            id: order.id,
            reference: order.reference,
            supplierId: order.supplierId,
            supplierName: order.supplierName,
            expectedDate: order.expectedDate,
            status: order.status,
            category: deliveryCategory(order, today),
            quantity: order.items.reduce(
                (sum, item) => sum + item.quantity - receivedUnits(order, item),
                0,
            ),
            cost:
                order.items.reduce(
                    (sum, item) =>
                        sum +
                        Math.round(item.unitCost * 100) *
                            (item.quantity - receivedUnits(order, item)),
                    0,
                ) / 100,
        }))
        .sort(
            (a, b) =>
                (a.expectedDate || "9999-12-31").localeCompare(b.expectedDate || "9999-12-31") ||
                a.reference.localeCompare(b.reference),
        );
}
export function purchaseScheduleVersion(order) {
    return JSON.stringify([purchaseProgress(order), order.expectedDate]);
}
export function reschedulePurchase(order, date, expected) {
    if (!order || !active(order) || purchaseScheduleVersion(order) !== expected)
        throw Error(
            "This purchase changed. Reopen the delivery date and review the latest details.",
        );
    if (
        typeof date !== "string" ||
        (date &&
            (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
                !Number.isFinite(Date.parse(date)) ||
                new Date(date).toISOString().slice(0, 10) !== date))
    )
        throw Error("Choose a valid expected delivery date, or leave it blank.");
    return { ...order, expectedDate: date };
}

export function deliverySuppliers(orders) {
    const suppliers = new Map();
    for (const order of orders)
        if (active(order) && !suppliers.has(order.supplierId))
            suppliers.set(order.supplierId, { id: order.supplierId, name: order.supplierName });
    return [...suppliers.values()].sort(
        (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
    );
}
export function deliveryRemindersCsv(rows) {
    const headings = [
        "Purchase reference",
        "Supplier",
        "Expected delivery (Asia/Manila)",
        "Status",
        "Reminder",
        "Outstanding units",
        "Outstanding item estimate (PHP)",
    ];
    return (
        "\uFEFF" +
        [
            headings,
            ...rows.map((row) => [
                row.reference,
                row.supplierName,
                row.expectedDate,
                row.status,
                row.category,
                row.quantity,
                row.cost.toFixed(2),
            ]),
        ]
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
            .join("\r\n")
    );
}
