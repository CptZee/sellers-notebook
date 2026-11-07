import { canonicalJson } from "./notebook-patch.mjs";
import { createRefund } from "./refunds.mjs";
import { transitionOrders } from "./order-management.mjs";
const same = (a, b) => canonicalJson(a) === canonicalJson(b);
export function orderCommand(
    document,
    command,
    today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date()),
) {
    if (
        !command ||
        !["sale", "refund", "remove-refund", "transition"].includes(command.kind) ||
        typeof command.id !== "string" ||
        !command.id ||
        command.id.length > 100 ||
        Object.keys(command).some(
            (key) => !["kind", "id", "input", "expected", "revision"].includes(key),
        )
    )
        throw Error("Invalid order command.");
    const { kind, id, input, expected } = command,
        orders = document.orders || [],
        products = document.products || [],
        refunds = document.refundRecords || [];
    if (kind === "transition") {
        if (
            !input ||
            Object.keys(input).some((key) => key !== "action") ||
            !["Completed", "Cancelled"].includes(input.action) ||
            !Array.isArray(expected) ||
            !expected.length ||
            expected.length > 100 ||
            expected.some((row) => !row || typeof row.id !== "string") ||
            new Set(expected.map((row) => row.id)).size !== expected.length
        )
            throw Error("Choose between 1 and 100 processing order lines.");
        const byId = new Map(orders.map((order, index) => [order.id, { order, index }]));
        if (expected.some((order) => !same(byId.get(order.id)?.order, order)))
            throw Error(
                "Some selected orders changed. Review the latest list and select them again.",
            );
        const result = transitionOrders(
                orders,
                products,
                expected.map((order) => order.id),
                input.action,
            ),
            selected = new Set(expected.map((order) => order.id));
        const changes = {
            orders: {
                remove: [],
                upsert: result.orders.flatMap((record, index) =>
                    selected.has(record.id) ? [{ index, record }] : [],
                ),
            },
        };
        const restored = result.products.flatMap((record, index) =>
            record !== products[index] ? [{ index, record }] : [],
        );
        if (restored.length) changes.products = { remove: [], upsert: restored };
        return changes;
    }
    if (kind === "sale") {
        const product = products.find((p) => p.id === expected?.id);
        if (!product || !same(product, expected))
            throw Error(
                "This product changed. Select it again to review its latest stock and price.",
            );
        if (orders.some((order) => order.id === id))
            throw Error(
                "This sale is already recorded. Refresh the order list before trying again.",
            );
        if (
            !input ||
            Object.keys(input).some(
                (key) =>
                    ![
                        "customer",
                        "channel",
                        "quantity",
                        "fee",
                        "packaging",
                        "shipping",
                        "date",
                    ].includes(key),
            ) ||
            typeof input.customer !== "string" ||
            !input.customer.trim() ||
            input.customer.trim().length > 200 ||
            !["Shopee", "Lazada", "TikTok Shop", "Direct"].includes(input.channel) ||
            !Number.isSafeInteger(input.quantity) ||
            input.quantity < 1 ||
            input.quantity > product.stock
        )
            throw Error("Choose a customer, channel and quantity within available stock.");
        if (
            ![input.fee, input.packaging, input.shipping].every(
                (n) => Number.isFinite(n) && n >= 0,
            ) ||
            input.fee >= 100 ||
            !/^\d{4}-\d{2}-\d{2}$/.test(input.date) ||
            !Number.isFinite(Date.parse(input.date)) ||
            new Date(input.date).toISOString().slice(0, 10) !== input.date
        )
            throw Error("Check the order date, fees and shipping costs.");
        const order = {
            id,
            productId: product.id,
            productName: product.name,
            customer: input.customer.trim(),
            channel: input.channel,
            quantity: input.quantity,
            price: product.price,
            cost: product.cost,
            fee: input.fee,
            packaging: input.packaging,
            shipping: input.shipping,
            date: input.date,
            status: "Processing",
        };
        return {
            orders: { remove: [], upsert: [{ index: 0, record: order }] },
            products: {
                remove: [],
                upsert: [
                    {
                        index: products.findIndex((p) => p.id === product.id),
                        record: { ...product, stock: product.stock - input.quantity },
                    },
                ],
            },
        };
    }
    if (kind === "refund") {
        if (
            !input ||
            Object.keys(input).some((key) => !["orderId", "amount", "date", "reason"].includes(key))
        )
            throw Error("Invalid refund input.");
        const order = orders.find((order) => order.id === input?.orderId);
        if (!order || !same(order, expected))
            throw Error("This order changed. Review its latest details before recording a refund.");
        if (refunds.some((record) => record.id === id))
            throw Error("This refund is already recorded. Review the latest history.");
        const record = { ...createRefund(orders, refunds, input, today), id };
        return { refundRecords: { remove: [], upsert: [{ index: 0, record }] } };
    }
    const record = refunds.find((record) => record.id === id);
    if (!record || !same(record, expected))
        throw Error("This refund changed or was removed. Review the latest history.");
    return { refundRecords: { remove: [id], upsert: [] } };
}
