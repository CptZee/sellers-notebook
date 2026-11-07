import {
    cancelRefundAvailable,
    returnCreditCents,
    returnCashCents,
    validGoodsReturnRefunds,
} from "./supplier-returns.mjs";
export const paymentMethods = ["Bank transfer", "E-wallet", "Cash", "Other"];
export function validPurchasePayments(
    records,
    totalCents,
    today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }),
) {
    if (!Array.isArray(records) || records.length > 100) return false;
    const ids = new Set();
    let paid = 0;
    for (const p of records) {
        if (
            !p ||
            typeof p.id !== "string" ||
            !p.id.trim() ||
            p.id.length > 100 ||
            ids.has(p.id) ||
            !Number.isFinite(p.amount) ||
            p.amount <= 0 ||
            !Number.isSafeInteger(Math.round(p.amount * 100)) ||
            Math.abs(p.amount * 100 - Math.round(p.amount * 100)) > 0.00001 ||
            typeof p.date !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(p.date) ||
            !Number.isFinite(Date.parse(p.date)) ||
            new Date(p.date).toISOString().slice(0, 10) !== p.date ||
            p.date > today ||
            !paymentMethods.includes(p.method) ||
            typeof p.reference !== "string" ||
            p.reference.length > 100 ||
            typeof p.notes !== "string" ||
            p.notes.length > 500
        )
            return false;
        paid += Math.round(p.amount * 100);
        if (!Number.isSafeInteger(paid) || paid > totalCents) return false;
        ids.add(p.id);
    }
    return true;
}
export function purchasePaymentSummary(order) {
    const originalCents = order.items.reduce(
        (sum, i) => sum + Math.round(i.unitCost * 100) * i.quantity,
        0,
    );
    const baseCents =
            order.status === "Cancelled"
                ? order.items.reduce(
                      (sum, i) => sum + Math.round(i.unitCost * 100) * (i.receivedQuantity ?? 0),
                      0,
                  )
                : originalCents,
        itemCents = baseCents - returnCreditCents(order);
    const paidCents = (order.payments || []).reduce(
        (sum, p) => sum + Math.round(p.amount * 100),
        0,
    );
    const refundedCents =
            (order.supplierRefunds || []).reduce((sum, p) => sum + Math.round(p.amount * 100), 0) +
            returnCashCents(order),
        netPaidCents = paidCents - refundedCents;
    return {
        originalTotal: originalCents / 100,
        itemTotal: itemCents / 100,
        paid: paidCents / 100,
        refunded: refundedCents / 100,
        netPaid: netPaidCents / 100,
        balance: Math.max(0, itemCents - netPaidCents) / 100,
        credit: Math.max(0, netPaidCents - itemCents) / 100,
        recordable:
            Math.max(
                0,
                Math.min(
                    originalCents - paidCents,
                    returnCreditCents(order) > 0
                        ? itemCents - netPaidCents
                        : originalCents - paidCents,
                ),
            ) / 100,
    };
}
export function addPurchasePayment(order, input, today) {
    if (!order || order.status === "Cancelled")
        throw Error("Payments can only be recorded on an open or received purchase.");
    if (Number(input.amount) > purchasePaymentSummary(order).recordable)
        throw Error("Payment exceeds the remaining recordable item balance.");
    const payment = {
        id: crypto.randomUUID(),
        amount: Number(input.amount),
        date: input.date,
        method: input.method,
        reference: String(input.reference || "").trim(),
        notes: String(input.notes || "").trim(),
    };
    const payments = [...(order.payments || []), payment];
    if (
        !validPurchasePayments(
            payments,
            Math.round(purchasePaymentSummary(order).originalTotal * 100),
            today,
        )
    )
        throw Error(
            "Check the amount, payment date, and details. Recorded payments cannot exceed the original item total; up to 100 records per purchase.",
        );
    return { ...order, payments };
}
export function purchasePaymentProgress(order) {
    return JSON.stringify([
        (order.goodsReturns || []).map((r) => [
            r.id,
            r.date,
            r.reason,
            r.createdAt,
            r.voidedAt ?? null,
            r.items.map((i) => [
                i.productId,
                i.quantity,
                i.unitCost,
                i.stockAdjustmentId,
                i.voidAdjustmentId ?? null,
            ]),
        ]),
        (order.goodsReturnRefunds || []).map((r) => [
            r.id,
            r.amount,
            r.date,
            r.method,
            r.reference,
            r.notes,
        ]),
        order.status,
        order.items.map((i) => [i.productId, i.quantity, i.unitCost, i.receivedQuantity ?? null]),
        (order.payments || []).map((p) => [p.id, p.amount, p.date, p.method, p.reference, p.notes]),
        (order.supplierRefunds || []).map((p) => [
            p.id,
            p.amount,
            p.date,
            p.method,
            p.reference,
            p.notes,
        ]),
    ]);
}

export function validSupplierRefunds(order, today) {
    const records = order.supplierRefunds === undefined ? [] : order.supplierRefunds;
    if (!Array.isArray(records) || (records.length > 0 && order.status !== "Cancelled"))
        return false;
    const paidCents = (order.payments || []).reduce(
            (sum, p) => sum + Math.round(p.amount * 100),
            0,
        ),
        receivedCents = order.items.reduce(
            (sum, i) => sum + Math.round(i.unitCost * 100) * (i.receivedQuantity ?? 0),
            0,
        );
    const earliest = (order.payments || []).map((p) => p.date).sort()[0];
    if (
        !validPurchasePayments(records, Math.max(0, paidCents - receivedCents), today) ||
        !records.every((p) => earliest && p.date >= earliest)
    )
        return false;
    let refunded = 0;
    for (const record of records.toSorted((a, b) => a.date.localeCompare(b.date))) {
        refunded += Math.round(record.amount * 100);
        const paidByDate = (order.payments || [])
            .filter((p) => p.date <= record.date)
            .reduce((sum, p) => sum + Math.round(p.amount * 100), 0);
        if (refunded > paidByDate) return false;
    }
    return true;
}
export function addSupplierRefund(order, input, today) {
    if (!order || order.status !== "Cancelled")
        throw Error("Record a supplier refund against a cancelled purchase with credit to review.");
    const record = {
        id: crypto.randomUUID(),
        amount: Number(input.amount),
        date: input.date,
        method: input.method,
        reference: String(input.reference || "").trim(),
        notes: String(input.notes || "").trim(),
    };
    const next = { ...order, supplierRefunds: [...(order.supplierRefunds || []), record] };
    if (!validSupplierRefunds(next, today))
        throw Error(
            "Check the refund amount, date, and details. Refunds cannot exceed credit from recorded payments or predate the first payment.",
        );
    return next;
}
export function removePurchasePayment(order, id) {
    const next = { ...order, payments: (order.payments || []).filter((p) => p.id !== id) };
    if (!validSupplierRefunds(next) || !validGoodsReturnRefunds(next))
        throw Error(
            "This payment supports a supplier refund record. Correct the mistaken refund record first.",
        );
    return next;
}
export function eligibleFinancialPurchases(orders, kind) {
    return orders
        .filter((order) =>
            kind === "payment"
                ? order.status !== "Cancelled" &&
                  purchasePaymentSummary(order).recordable > 0 &&
                  (order.payments?.length || 0) < 100
                : order.status === "Cancelled" &&
                  cancelRefundAvailable(order) > 0 &&
                  (order.supplierRefunds?.length || 0) < 100,
        )
        .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
}
