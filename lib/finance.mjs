export function pricing(cost, packaging, shipping, fee, margin, tax = 0) {
    const base = cost + packaging + shipping;
    if (
        [cost, packaging, shipping, fee, margin, tax].some((v) => !Number.isFinite(v) || v < 0) ||
        fee + margin + tax >= 100
    )
        return null;
    const price = base / (1 - (fee + margin + tax) / 100);
    return {
        price,
        profit: (price * margin) / 100,
        fees: (price * fee) / 100,
        taxes: (price * tax) / 100,
        base,
    };
}
export function orderTotals(order) {
    const revenue = order.price * order.quantity;
    const expense =
        order.cost * order.quantity +
        (revenue * order.fee) / 100 +
        order.packaging +
        order.shipping;
    return { revenue, expense, profit: revenue - expense };
}
