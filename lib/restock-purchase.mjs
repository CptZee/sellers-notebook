import { restockPlan } from "./restock-plan.mjs";
import { receivedUnits } from "./purchases.mjs";
const open = (order) => ["Ordered", "Partially received"].includes(order.status);
export function restockDraftVersion(supplier, products, orders) {
    return JSON.stringify([
        supplier,
        products.map((p) => [p.id, p.name, p.sku, p.stock, p.cost, p.reorderPoint, p.targetStock]),
        orders.filter(open).map((order) => [order.id, order.items]),
    ]);
}
export function restockPurchaseDraft(supplier, products, orders, productIds) {
    if (!supplier) throw Error("Choose a saved supplier to prepare a purchase.");
    const lines = restockIncomingPlan(products, orders)
        .filter(
            (item) =>
                supplier.productIds.includes(item.id) &&
                (!productIds || productIds.includes(item.id)) &&
                item.toBuy > 0,
        )
        .map((item) => ({ productId: item.id, quantity: item.toBuy, unitCost: item.unitCost }));
    if (!lines.length)
        throw Error(
            "No additional units are needed for this supplier after allowing for open purchases.",
        );
    if (lines.length > 100)
        throw Error(
            "This plan needs more than 100 product lines. Create purchases in smaller groups.",
        );
    return {
        supplierId: supplier.id,
        lines,
        version: restockDraftVersion(supplier, products, orders),
    };
}
export function filterRestockPlan(
    plan,
    suppliers,
    { supplierId = "all", view = "All low-stock products", search = "" } = {},
) {
    const query = search.trim().toLowerCase();
    return plan.filter(
        (item) =>
            (supplierId === "all" ||
                (supplierId === "unlinked"
                    ? !suppliers.some((s) => s.productIds.includes(item.id))
                    : suppliers.some(
                          (s) => s.id === supplierId && s.productIds.includes(item.id),
                      ))) &&
            (view === "All low-stock products" ||
                (view === "Needs buying"
                    ? item.toBuy > 0
                    : view === "Covered by incoming stock" && item.toBuy === 0)) &&
            [item.name, item.sku].join(" ").toLowerCase().includes(query),
    );
}
export function restockIncomingPlan(products, orders) {
    const incoming = new Map();
    for (const order of orders.filter(open))
        for (const item of order.items)
            incoming.set(
                item.productId,
                (incoming.get(item.productId) || 0) + item.quantity - receivedUnits(order, item),
            );
    return restockPlan(products).map((item) => {
        const onOrder = incoming.get(item.id) || 0,
            toBuy = Math.max(0, item.quantity - onOrder);
        return {
            ...item,
            onOrder,
            toBuy,
            buyEstimate: (Math.round(item.unitCost * 100) * toBuy) / 100,
        };
    });
}
export function restockIncomingCsv(plan, suppliers) {
    const headings = [
        "Product",
        "SKU",
        "Current stock",
        "Alert at",
        "Target stock",
        "Stock shortfall",
        "On order (all suppliers)",
        "Additional units to buy",
        "Unit cost (PHP)",
        "Additional item estimate (PHP)",
        "Supplier options",
        "Lead times (days)",
    ];
    const rows = plan.map((item) => [
        item.name,
        item.sku,
        item.stock,
        item.reorderPoint,
        item.targetStock,
        item.quantity,
        item.onOrder,
        item.toBuy,
        item.unitCost.toFixed(2),
        item.buyEstimate.toFixed(2),
        suppliers
            .filter((s) => s.productIds.includes(item.id))
            .map((s) => s.name)
            .join("; "),
        suppliers
            .filter((s) => s.productIds.includes(item.id))
            .map((s) => `${s.name}: ${s.leadTimeDays || "unspecified"}`)
            .join("; "),
    ]);
    return (
        "\uFEFF" +
        [headings, ...rows]
            .map((row) =>
                row
                    .map(
                        (value) =>
                            '"' +
                            String(value)
                                .replace(/^\s*[=+@-]/, "'$&")
                                .replaceAll('"', '""') +
                            '"',
                    )
                    .join(","),
            )
            .join("\r\n")
    );
}
