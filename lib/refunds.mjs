export const refundTotal = (records) =>
    records.reduce((cents, record) => cents + Math.round(record.amount * 100), 0) / 100;
export function createRefund(
    orders,
    records,
    input,
    today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date()),
) {
    const order = orders.find((item) => item.id === input.orderId),
        amount = input.amount;
    if (!order || order.status !== "Completed") throw Error("Choose a completed order line.");
    if (
        !Number.isFinite(amount) ||
        amount <= 0 ||
        amount > 100000000 ||
        Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001
    )
        throw Error("Enter a positive refund amount with up to two decimals.");
    if (
        !/^\d{4}-\d{2}-\d{2}$/.test(input.date) ||
        !Number.isFinite(Date.parse(input.date)) ||
        new Date(input.date).toISOString().slice(0, 10) !== input.date ||
        input.date < order.date ||
        input.date > today
    )
        throw Error("Choose a refund date between the order date and today.");
    if (
        typeof input.reason !== "string" ||
        !input.reason.trim() ||
        input.reason.trim().length > 200
    )
        throw Error("Enter a reason of up to 200 characters.");
    const refunded = records
        .filter((record) => record.orderId === order.id)
        .reduce((cents, record) => cents + Math.round(record.amount * 100), 0);
    if (refunded + Math.round(amount * 100) > Math.round(order.price * order.quantity * 100))
        throw Error("Refunds cannot exceed the recorded item value for this order line.");
    if (records.length >= 10000) throw Error("Refund history has reached its 10,000-entry limit.");
    return {
        id: crypto.randomUUID(),
        orderId: order.id,
        amount,
        date: input.date,
        reason: input.reason.trim(),
    };
}
