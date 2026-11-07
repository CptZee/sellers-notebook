import { validPurchaseOrders } from "./purchases.mjs";
const validText = (v, max = 200) => typeof v === "string" && v.length > 0 && v.length <= max;
const amount = (v) => Number.isFinite(v) && v >= 0 && v <= 100000000;
export function validDocument(doc) {
    if (
        !doc ||
        !Array.isArray(doc.products) ||
        !Array.isArray(doc.orders) ||
        doc.products.length > 3000 ||
        doc.orders.length > 15000
    )
        return false;
    if (doc.expenses !== undefined && (!Array.isArray(doc.expenses) || doc.expenses.length > 10000))
        return false;
    if (
        doc.sidebarNote !== undefined &&
        (typeof doc.sidebarNote !== "string" || doc.sidebarNote.length > 200)
    )
        return false;
    if (doc.branding !== undefined && doc.branding !== null) {
        const b = doc.branding;
        if (
            !b ||
            !validText(b.businessName, 48) ||
            !b.businessName.trim() ||
            !validText(b.notebookTitle, 40) ||
            !b.notebookTitle.trim() ||
            typeof b.tagline !== "string" ||
            b.tagline.length > 100 ||
            !["notebook", "store", "sprout"].includes(b.icon)
        )
            return false;
    }
    if (
        doc.stockAdjustments !== undefined &&
        (!Array.isArray(doc.stockAdjustments) || doc.stockAdjustments.length > 10000)
    )
        return false;
    const adjustmentIds = new Set();
    for (const item of doc.stockAdjustments || []) {
        if (
            !item ||
            !validText(item.id, 100) ||
            adjustmentIds.has(item.id) ||
            !validText(item.productId, 100) ||
            !validText(item.productName) ||
            !validText(item.sku, 100) ||
            !["Restock", "Damage", "Correction", "Supplier return"].includes(item.kind) ||
            ![item.before, item.after].every(
                (n) => Number.isSafeInteger(n) && n >= 0 && n <= 10000000,
            ) ||
            item.before === item.after ||
            !validText(item.reason) ||
            !item.reason.trim() ||
            typeof item.createdAt !== "string" ||
            !Number.isFinite(Date.parse(item.createdAt)) ||
            (item.kind === "Restock" && item.after < item.before) ||
            (["Damage", "Supplier return"].includes(item.kind) && item.after > item.before)
        )
            return false;
        adjustmentIds.add(item.id);
    }
    const expenseIds = new Set();
    for (const expense of doc.expenses || []) {
        if (
            !expense ||
            !validText(expense.id, 100) ||
            expenseIds.has(expense.id) ||
            !validText(expense.title) ||
            ![
                "Advertising",
                "Software",
                "Rent & utilities",
                "Office supplies",
                "Professional services",
                "Other",
            ].includes(expense.category) ||
            !amount(expense.amount) ||
            expense.amount <= 0 ||
            Math.abs(expense.amount * 100 - Math.round(expense.amount * 100)) > 0.00001 ||
            !["Business", "Shopee", "Lazada", "TikTok Shop", "Direct"].includes(expense.channel) ||
            typeof expense.notes !== "string" ||
            expense.notes.length > 1000 ||
            !/^\d{4}-\d{2}-\d{2}$/.test(expense.date) ||
            !Number.isFinite(Date.parse(expense.date)) ||
            new Date(expense.date).toISOString().slice(0, 10) !== expense.date
        )
            return false;
        expenseIds.add(expense.id);
    }
    const ids = new Set(),
        skus = new Set(),
        orders = new Set();
    for (const p of doc.products) {
        const point = p?.reorderPoint ?? 10,
            target = p?.targetStock ?? Math.max(20, point + 1);
        if (
            !Number.isSafeInteger(point) ||
            point < 0 ||
            point >= 10000000 ||
            !Number.isSafeInteger(target) ||
            target <= point ||
            target > 10000000
        )
            return false;
        if (
            !p ||
            !validText(p.id, 100) ||
            ids.has(p.id) ||
            !validText(p.name) ||
            !validText(p.sku, 100) ||
            skus.has(p.sku.toLowerCase()) ||
            !validText(p.category) ||
            !amount(p.cost) ||
            !amount(p.price) ||
            !Number.isInteger(p.stock) ||
            p.stock < 0 ||
            p.stock > 10000000 ||
            !/^#[0-9a-fA-F]{6}$/.test(p.color) ||
            !validText(p.symbol, 20)
        )
            return false;
        ids.add(p.id);
        skus.add(p.sku.toLowerCase());
    }
    if (
        doc.suppliers !== undefined &&
        (!Array.isArray(doc.suppliers) || doc.suppliers.length > 1000)
    )
        return false;
    const supplierIds = new Set();
    for (const supplier of doc.suppliers || []) {
        if (
            !supplier ||
            !validText(supplier.id, 100) ||
            supplierIds.has(supplier.id) ||
            !validText(supplier.name) ||
            !supplier.name.trim() ||
            !Number.isInteger(supplier.leadTimeDays) ||
            supplier.leadTimeDays < 0 ||
            supplier.leadTimeDays > 3650 ||
            !Array.isArray(supplier.productIds) ||
            supplier.productIds.length > 3000 ||
            new Set(supplier.productIds).size !== supplier.productIds.length ||
            supplier.productIds.some((id) => !ids.has(id))
        )
            return false;
        for (const [key, max] of [
            ["contact", 200],
            ["email", 254],
            ["phone", 80],
            ["address", 1000],
            ["notes", 1000],
        ])
            if (typeof supplier[key] !== "string" || supplier[key].length > max) return false;
        if (supplier.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supplier.email)) return false;
        supplierIds.add(supplier.id);
    }
    for (const o of doc.orders) {
        if (o?.stockApplied !== undefined && typeof o.stockApplied !== "boolean") return false;
        if (o?.sourceOrderId !== undefined && !validText(o.sourceOrderId, 100)) return false;
        if (
            !o ||
            !validText(o.id, 100) ||
            orders.has(o.id) ||
            !ids.has(o.productId) ||
            !validText(o.productName) ||
            !validText(o.customer) ||
            !["Shopee", "Lazada", "TikTok Shop", "Direct"].includes(o.channel) ||
            !Number.isInteger(o.quantity) ||
            o.quantity < 1 ||
            o.quantity > 10000000 ||
            !amount(o.price) ||
            !amount(o.cost) ||
            !amount(o.fee) ||
            o.fee >= 100 ||
            !amount(o.packaging) ||
            !amount(o.shipping) ||
            !["Completed", "Processing", "Cancelled"].includes(o.status) ||
            !/^\d{4}-\d{2}-\d{2}$/.test(o.date) ||
            !Number.isFinite(Date.parse(o.date)) ||
            new Date(o.date).toISOString().slice(0, 10) !== o.date
        )
            return false;
        orders.add(o.id);
    }
    if (
        doc.refundRecords !== undefined &&
        (!Array.isArray(doc.refundRecords) || doc.refundRecords.length > 10000)
    )
        return false;
    const refundIds = new Set(),
        refunded = new Map(),
        orderMap = new Map(doc.orders.map((order) => [order.id, order]));
    for (const record of doc.refundRecords || []) {
        const order = orderMap.get(record?.orderId);
        if (
            !record ||
            !validText(record.id, 100) ||
            refundIds.has(record.id) ||
            !order ||
            order.status !== "Completed" ||
            !amount(record.amount) ||
            record.amount <= 0 ||
            Math.abs(record.amount * 100 - Math.round(record.amount * 100)) > 0.00001 ||
            !validText(record.reason) ||
            !record.reason.trim() ||
            !/^\d{4}-\d{2}-\d{2}$/.test(record.date) ||
            !Number.isFinite(Date.parse(record.date)) ||
            new Date(record.date).toISOString().slice(0, 10) !== record.date ||
            record.date < order.date
        )
            return false;
        const total = (refunded.get(record.orderId) || 0) + Math.round(record.amount * 100);
        if (total > Math.round(order.price * order.quantity * 100)) return false;
        refunded.set(record.orderId, total);
        refundIds.add(record.id);
    }
    if (doc.purchaseOrders !== undefined && !validPurchaseOrders(doc.purchaseOrders, doc.products))
        return false;
    const linkedAdjustments = new Set(),
        byAdjustment = new Map((doc.stockAdjustments || []).map((r) => [r.id, r]));
    for (const purchase of doc.purchaseOrders || [])
        for (const returned of purchase.goodsReturns || [])
            for (const line of returned.items) {
                for (const [key, kind, direction] of [
                    ["stockAdjustmentId", "Supplier return", -1],
                    ...(returned.voidedAt ? [["voidAdjustmentId", "Correction", 1]] : []),
                ]) {
                    const event = byAdjustment.get(line[key]);
                    if (
                        !event ||
                        linkedAdjustments.has(event.id) ||
                        event.productId !== line.productId ||
                        event.kind !== kind ||
                        event.after - event.before !== direction * line.quantity
                    )
                        return false;
                    linkedAdjustments.add(event.id);
                }
            }
    return true;
}
