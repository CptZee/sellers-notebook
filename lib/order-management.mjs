export function transitionOrders(orders, products, ids, action) {
    if (!["Completed", "Cancelled"].includes(action) || !Array.isArray(ids) || !ids.length)
        throw Error("Choose processing orders first.");
    const selected = new Set(ids),
        rows = orders.filter((order) => selected.has(order.id));
    if (rows.length !== selected.size || rows.some((order) => order.status !== "Processing"))
        throw Error("Some selected orders changed. Review the current list and select them again.");
    const restored = new Map();
    if (action === "Cancelled")
        for (const order of rows)
            if (order.stockApplied !== false)
                restored.set(
                    order.productId,
                    (restored.get(order.productId) || 0) + order.quantity,
                );
    for (const [id, quantity] of restored) {
        const product = products.find((item) => item.id === id);
        if (
            !product ||
            !Number.isSafeInteger(product.stock + quantity) ||
            product.stock + quantity > 10000000
        )
            throw Error(
                "Stock cannot be restored safely. Review these products before cancelling.",
            );
    }
    return {
        orders: orders.map((order) =>
            selected.has(order.id) ? { ...order, status: action } : order,
        ),
        products: restored.size
            ? products.map((product) =>
                  restored.has(product.id)
                      ? { ...product, stock: product.stock + restored.get(product.id) }
                      : product,
              )
            : products,
        count: rows.length,
    };
}
export function filterOrderList(
    orders,
    products,
    search = "",
    status = "All statuses",
    sort = "newest",
) {
    const sku = new Map(products.map((product) => [product.id, product.sku]));
    const query = search.trim().toLowerCase();
    return orders
        .filter(
            (order) =>
                (status === "All statuses" || order.status === status) &&
                [
                    order.id,
                    order.sourceOrderId || "",
                    order.customer,
                    order.productName,
                    sku.get(order.productId) || "",
                ]
                    .join(" ")
                    .toLowerCase()
                    .includes(query),
        )
        .sort((a, b) =>
            sort === "oldest"
                ? a.date.localeCompare(b.date) || a.id.localeCompare(b.id)
                : sort === "value"
                  ? b.price * b.quantity - a.price * a.quantity ||
                    b.date.localeCompare(a.date) ||
                    a.id.localeCompare(b.id)
                  : b.date.localeCompare(a.date) || a.id.localeCompare(b.id),
        );
}
