const cents = (n) => Math.round(n * 100),
    received = (order, item) =>
        item.receivedQuantity ?? (order.status === "Received" ? item.quantity : 0);
const text = (s, n) => typeof s === "string" && s.trim().length > 0 && s.length <= n;
const day = (s, today) =>
    typeof s === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    Number.isFinite(Date.parse(s)) &&
    new Date(s).toISOString().slice(0, 10) === s &&
    s <= today;
export function returnedUnits(order, productId) {
    return (order.goodsReturns ?? [])
        .filter((r) => !r.voidedAt)
        .reduce(
            (sum, r) =>
                sum +
                r.items
                    .filter((i) => i.productId === productId)
                    .reduce((n, i) => n + i.quantity, 0),
            0,
        );
}
export function returnCreditCents(order, date = "9999-12-31") {
    return (order.goodsReturns ?? [])
        .filter((r) => !r.voidedAt && r.date <= date)
        .reduce(
            (sum, r) => sum + r.items.reduce((n, i) => n + cents(i.unitCost) * i.quantity, 0),
            0,
        );
}
export function returnCashCents(order, date = "9999-12-31") {
    return (order.goodsReturnRefunds ?? [])
        .filter((r) => r.date <= date)
        .reduce((sum, r) => sum + cents(r.amount), 0);
}
export function returnRefundAvailable(order, date = "9999-12-31") {
    const base = order.items.reduce(
            (sum, i) =>
                sum +
                cents(i.unitCost) *
                    (order.status === "Cancelled" ? received(order, i) : i.quantity),
            0,
        ),
        credit = returnCreditCents(order, date),
        paid = (order.payments || [])
            .filter((p) => p.date <= date)
            .reduce((n, p) => n + cents(p.amount), 0),
        cancelRefund = (order.supplierRefunds || [])
            .filter((p) => p.date <= date)
            .reduce((n, p) => n + cents(p.amount), 0);
    return (
        Math.max(
            0,
            Math.min(credit, paid - base + credit - cancelRefund) - returnCashCents(order, date),
        ) / 100
    );
}
export function validGoodsReturns(
    order,
    today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }),
) {
    const records = order.goodsReturns ?? [];
    if (!Array.isArray(records) || records.length > 100) return false;
    const ids = new Set(),
        stockIds = new Set(),
        totals = new Map();
    for (const r of records) {
        if (
            !r ||
            !text(r.id, 100) ||
            ids.has(r.id) ||
            !day(r.date, today) ||
            r.date <
                new Date(order.createdAt).toLocaleDateString("en-CA", {
                    timeZone: "Asia/Manila",
                }) ||
            !text(r.reason, 200) ||
            !Number.isFinite(Date.parse(r.createdAt)) ||
            (r.voidedAt !== undefined && !Number.isFinite(Date.parse(r.voidedAt))) ||
            !Array.isArray(r.items) ||
            !r.items.length ||
            r.items.length > 100
        )
            return false;
        ids.add(r.id);
        const products = new Set();
        for (const i of r.items) {
            const original = order.items.find((p) => p.productId === i?.productId);
            if (
                !original ||
                products.has(i.productId) ||
                !Number.isSafeInteger(i.quantity) ||
                i.quantity < 1 ||
                i.quantity > 10000000 ||
                i.unitCost !== original.unitCost ||
                !text(i.productName, 200) ||
                !text(i.sku, 100) ||
                !text(i.stockAdjustmentId, 100) ||
                stockIds.has(i.stockAdjustmentId) ||
                (r.voidedAt ? !text(i?.voidAdjustmentId, 100) : i?.voidAdjustmentId !== undefined)
            )
                return false;
            products.add(i.productId);
            stockIds.add(i.stockAdjustmentId);
            if (i.voidAdjustmentId) {
                if (stockIds.has(i.voidAdjustmentId)) return false;
                stockIds.add(i.voidAdjustmentId);
            }
            if (!r.voidedAt) totals.set(i.productId, (totals.get(i.productId) || 0) + i.quantity);
        }
    }
    return order.items.every((i) => (totals.get(i.productId) || 0) <= received(order, i));
}
export function validGoodsReturnRefunds(
    order,
    today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }),
) {
    const records = order.goodsReturnRefunds ?? [];
    if (!Array.isArray(records) || records.length > 100) return false;
    const ids = new Set();
    let cumulative = 0;
    for (const r of records.toSorted((a, b) => String(a?.date).localeCompare(String(b?.date)))) {
        if (
            !r ||
            !text(r.id, 100) ||
            ids.has(r.id) ||
            !Number.isFinite(r.amount) ||
            r.amount <= 0 ||
            !Number.isSafeInteger(cents(r.amount)) ||
            Math.abs(r.amount * 100 - cents(r.amount)) > 0.00001 ||
            !day(r.date, today) ||
            !["Bank transfer", "E-wallet", "Cash", "Other"].includes(r.method) ||
            typeof r.reference !== "string" ||
            r.reference.length > 100 ||
            typeof r.notes !== "string" ||
            r.notes.length > 500
        )
            return false;
        ids.add(r.id);
        cumulative += cents(r.amount);
        if (cumulative > cents(returnRefundAvailable({ ...order, goodsReturnRefunds: [] }, r.date)))
            return false;
    }
    return true;
}
export function goodsReturn(order, products, history, input, id) {
    if (!text(id, 100) || (order.goodsReturns ?? []).some((r) => r.id === id))
        throw Error("This return was already recorded. Review the latest purchase.");
    if (
        !input ||
        Object.keys(input).some((k) => !["items", "date", "reason"].includes(k)) ||
        !Array.isArray(input.items) ||
        !input.items.length ||
        input.items.length > 100
    )
        throw Error("Choose up to 100 received product lines.");
    if ((order.goodsReturns?.length || 0) >= 100 || history.length + input.items.length > 10000)
        throw Error("The return or stock-history limit has been reached.");
    const seen = new Set(),
        changes = [],
        items = [];
    for (const line of input.items) {
        const original = order.items.find((i) => i.productId === line?.productId),
            product = products.find((p) => p.id === line?.productId),
            q = line?.quantity;
        if (
            !line ||
            Object.keys(line).some((k) => !["productId", "quantity"].includes(k)) ||
            !original ||
            !product ||
            seen.has(line.productId) ||
            !Number.isSafeInteger(q) ||
            q < 1 ||
            q > received(order, original) - returnedUnits(order, line.productId) ||
            q > product.stock
        )
            throw Error(
                "Return whole units within the unreturned received quantity and current available stock.",
            );
        seen.add(line.productId);
        const adjustment = {
            id: crypto.randomUUID(),
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            kind: "Supplier return",
            before: product.stock,
            after: product.stock - q,
            reason: `Returned ${order.reference}`,
            createdAt: new Date().toISOString(),
        };
        changes.push(adjustment);
        items.push({
            productId: original.productId,
            productName: original.productName,
            sku: original.sku,
            quantity: q,
            unitCost: original.unitCost,
            stockAdjustmentId: adjustment.id,
        });
    }
    const record = {
            id,
            date: input.date,
            reason: typeof input.reason === "string" ? input.reason.trim() : "",
            createdAt: new Date().toISOString(),
            items,
        },
        next = { ...order, goodsReturns: [...(order.goodsReturns ?? []), record] };
    if (!validGoodsReturns(next))
        throw Error(
            "Check the return date and reason. Only previously received units can be returned.",
        );
    const stock = new Map(changes.map((c) => [c.productId, c.after]));
    return {
        order: next,
        products: products.map((p) => (stock.has(p.id) ? { ...p, stock: stock.get(p.id) } : p)),
        stockAdjustments: [...changes, ...history],
    };
}
export function voidGoodsReturn(order, products, history, id) {
    const r = order.goodsReturns?.find((r) => r.id === id);
    if (!r || r.voidedAt) throw Error("This return changed or was already voided.");
    const next = {
        ...order,
        goodsReturns: order.goodsReturns.map((row) =>
            row.id === id ? { ...row, voidedAt: new Date().toISOString() } : row,
        ),
    };
    if (!validGoodsReturnRefunds(next))
        throw Error("Correct supporting return-refund entries before voiding this return.");
    if (history.length + r.items.length > 10000)
        throw Error("Stock history has reached its limit.");
    const changes = r.items.map((i) => {
        const p = products.find((p) => p.id === i.productId);
        if (!p || p.stock + i.quantity > 10000000)
            throw Error("Restored stock would exceed the inventory limit.");
        return {
            id: crypto.randomUUID(),
            productId: p.id,
            productName: p.name,
            sku: p.sku,
            kind: "Correction",
            before: p.stock,
            after: p.stock + i.quantity,
            reason: `Voided return ${order.reference}`,
            createdAt: new Date().toISOString(),
        };
    });
    const stock = new Map(changes.map((c) => [c.productId, c.after]));
    next.goodsReturns = next.goodsReturns.map((row) =>
        row.id === id
            ? {
                  ...row,
                  items: row.items.map((i) => ({
                      ...i,
                      voidAdjustmentId: changes.find((c) => c.productId === i.productId).id,
                  })),
              }
            : row,
    );
    return {
        order: next,
        products: products.map((p) => (stock.has(p.id) ? { ...p, stock: stock.get(p.id) } : p)),
        stockAdjustments: [...changes, ...history],
    };
}
export function addGoodsReturnRefund(order, input, id) {
    if (!text(id, 100) || (order.goodsReturnRefunds ?? []).some((r) => r.id === id))
        throw Error("This return refund was already recorded.");
    const record = {
            id,
            amount: Number(input?.amount),
            date: input?.date,
            method: input?.method,
            reference: String(input?.reference || "").trim(),
            notes: String(input?.notes || "").trim(),
        },
        next = { ...order, goodsReturnRefunds: [...(order.goodsReturnRefunds ?? []), record] };
    if (!validGoodsReturnRefunds(next))
        throw Error(
            "Return cash cannot exceed paid credit for returned goods or predate the supporting return and payment.",
        );
    return next;
}

export function cancelRefundAvailable(order) {
    if (order.status !== "Cancelled") return 0;
    return (
        Math.max(
            0,
            (order.payments || []).reduce((n, r) => n + cents(r.amount), 0) -
                order.items.reduce((n, i) => n + cents(i.unitCost) * received(order, i), 0) -
                (order.supplierRefunds || []).reduce((n, r) => n + cents(r.amount), 0),
        ) / 100
    );
}
