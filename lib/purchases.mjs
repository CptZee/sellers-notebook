import { validGoodsReturns, validGoodsReturnRefunds } from "./supplier-returns.mjs";
import { validPurchasePayments, validSupplierRefunds } from "./purchase-payments.mjs";
import { stockChange } from "./stock-adjustments.mjs";
export function validPurchaseOrders(records, products) {
    if (!Array.isArray(records) || records.length > 3000) return false;
    const ids = new Set(),
        productIds = new Set(products.map((p) => p.id));
    const text = (v, max) => typeof v === "string" && v.trim().length > 0 && v.length <= max;
    const time = (v) => typeof v === "string" && Number.isFinite(Date.parse(v));
    for (const order of records) {
        if (
            !order ||
            !text(order.id, 100) ||
            ids.has(order.id) ||
            !text(order.reference, 100) ||
            !text(order.supplierId, 100) ||
            !text(order.supplierName, 200) ||
            !time(order.createdAt) ||
            !["Ordered", "Partially received", "Received", "Cancelled"].includes(order.status) ||
            typeof order.notes !== "string" ||
            order.notes.length > 1000 ||
            typeof order.expectedDate !== "string" ||
            (order.expectedDate &&
                (!/^\d{4}-\d{2}-\d{2}$/.test(order.expectedDate) ||
                    !Number.isFinite(Date.parse(order.expectedDate)) ||
                    new Date(order.expectedDate).toISOString().slice(0, 10) !==
                        order.expectedDate)) ||
            !Array.isArray(order.items) ||
            !order.items.length ||
            order.items.length > 100
        )
            return false;
        if (order.status === "Received" ? !time(order.receivedAt) : order.receivedAt !== undefined)
            return false;
        if (
            order.status === "Cancelled"
                ? !time(order.cancelledAt)
                : order.cancelledAt !== undefined
        )
            return false;
        const lines = new Set();
        let totalCents = 0;
        for (const item of order.items) {
            if (
                !item ||
                !productIds.has(item.productId) ||
                lines.has(item.productId) ||
                !text(item.productName, 200) ||
                !text(item.sku, 100) ||
                !Number.isSafeInteger(item.quantity) ||
                item.quantity < 1 ||
                item.quantity > 10000000 ||
                !Number.isFinite(item.unitCost) ||
                item.unitCost < 0 ||
                item.unitCost > 100000000 ||
                Math.abs(item.unitCost * 100 - Math.round(item.unitCost * 100)) > 0.00001
            )
                return false;
            lines.add(item.productId);
        }
        for (const item of order.items) {
            totalCents += Math.round(item.unitCost * 100) * item.quantity;
            if (!Number.isSafeInteger(totalCents)) return false;
        }
        if (order.payments !== undefined && !validPurchasePayments(order.payments, totalCents))
            return false;
        const received = order.items.map((item) => receivedUnits(order, item));
        if (
            received.some(
                (n, i) => !Number.isSafeInteger(n) || n < 0 || n > order.items[i].quantity,
            )
        )
            return false;
        const any = received.some((n) => n > 0),
            complete = received.every((n, i) => n === order.items[i].quantity);
        if (
            (order.status === "Ordered" && any) ||
            (order.status === "Partially received" && (!any || complete)) ||
            (order.status === "Received" && !complete) ||
            (order.status === "Cancelled" && complete)
        )
            return false;
        if (order.supplierRefunds !== undefined && !validSupplierRefunds(order)) return false;
        if (!validGoodsReturns(order) || !validGoodsReturnRefunds(order)) return false;
        ids.add(order.id);
    }
    return true;
}
export function createPurchase(supplier, lines, products, notes = "", expectedDate = "") {
    if (!supplier) throw Error("Choose a saved supplier.");
    const id = crypto.randomUUID(),
        createdAt = new Date().toISOString();
    const items = lines.map((line) => {
        const product = products.find((p) => p.id === line.productId);
        if (!product || !supplier.productIds.includes(product.id))
            throw Error("Choose inventory items linked to this supplier.");
        return {
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            quantity: Number(line.quantity),
            unitCost: Number(line.unitCost),
        };
    });
    const localDate = new Date(createdAt).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    const order = {
        id,
        reference: `PO-${localDate}-${id.slice(0, 8)}`,
        supplierId: supplier.id,
        supplierName: supplier.name,
        createdAt,
        expectedDate,
        notes: notes.trim(),
        items,
        payments: [],
        supplierRefunds: [],
        status: "Ordered",
    };
    if (!validPurchaseOrders([order], products))
        throw Error(
            "Check the quantities, unit costs, delivery date, and notes. Use one line per product (up to 100).",
        );
    return order;
}
export function receivedUnits(order, item) {
    return item.receivedQuantity ?? (order.status === "Received" ? item.quantity : 0);
}
export function purchaseProgress(order) {
    return JSON.stringify([
        order.status,
        order.items.map((item) => [item.productId, receivedUnits(order, item)]),
    ]);
}
export function receivePurchase(order, products, history, delivery) {
    if (
        !order ||
        !["Ordered", "Partially received"].includes(order.status) ||
        !validPurchaseOrders([order], products)
    )
        throw Error("Only a valid outstanding purchase can be received.");
    const selected =
        delivery ??
        Object.fromEntries(
            order.items.map((item) => [item.productId, item.quantity - receivedUnits(order, item)]),
        );
    if (
        !selected ||
        typeof selected !== "object" ||
        Array.isArray(selected) ||
        Object.keys(selected).some((id) => !order.items.some((item) => item.productId === id))
    )
        throw Error("Choose items on this purchase.");
    const quantities = order.items.map((item) => selected[item.productId] ?? 0);
    if (
        quantities.some(
            (n, i) =>
                !Number.isSafeInteger(n) ||
                n < 0 ||
                n > order.items[i].quantity - receivedUnits(order, order.items[i]),
        ) ||
        !quantities.some((n) => n > 0)
    )
        throw Error(
            "Enter whole received units within the outstanding quantity, with at least one item received.",
        );
    if (history.length + quantities.filter((n) => n > 0).length > 10000)
        throw Error("Stock history has reached its limit. This delivery has not been received.");
    const changes = order.items.flatMap((item, index) =>
        quantities[index]
            ? [
                  stockChange(
                      products.find((p) => p.id === item.productId),
                      "Restock",
                      quantities[index],
                      `Received ${order.reference}`,
                  ),
              ]
            : [],
    );
    const stock = new Map(changes.map((change) => [change.productId, change.after]));
    const items = order.items.map((item, index) => ({
            ...item,
            receivedQuantity: receivedUnits(order, item) + quantities[index],
        })),
        complete = items.every((item) => item.receivedQuantity === item.quantity);
    return {
        order: {
            ...order,
            items,
            status: complete ? "Received" : "Partially received",
            ...(complete ? { receivedAt: new Date().toISOString() } : {}),
        },
        products: products.map((p) => (stock.has(p.id) ? { ...p, stock: stock.get(p.id) } : p)),
        stockAdjustments: [...changes, ...history],
    };
}
