import test from "node:test";
import assert from "node:assert/strict";
import { orderGroup, customerOrderSummary, customerOrderHtml } from "../lib/order-copy.mjs";
const order = {
    id: "line-1",
    sourceOrderId: "SHOP-123",
    channel: "Shopee",
    productName: "Canvas tote",
    customer: "Ana",
    quantity: 2,
    price: 100,
    cost: 987.65,
    fee: 10,
    packaging: 324.78,
    shipping: 5,
    date: "2026-11-05",
    status: "Completed",
};
const branding = {
    businessName: "Little Shop",
    notebookTitle: "My notebook",
    tagline: "Made with care",
    icon: "store",
};
test("marketplace detail groups include all recorded lines within the same channel only", () => {
    const orders = [
        order,
        { ...order, id: "line-2", sourceOrderId: "shop-123" },
        { ...order, id: "other-channel", channel: "Lazada" },
        { ...order, id: "manual", sourceOrderId: undefined },
    ];
    assert.equal(orderGroup(orders, "line-1").length, 2);
    assert.equal(orderGroup(orders, "manual").length, 1);
    assert.deepEqual(orderGroup(orders, "missing"), []);
});
test("customer summaries exclude private costs and cancelled lines from recorded totals", () => {
    const result = customerOrderSummary(
        [order, { ...order, id: "cancelled", status: "Cancelled" }],
        branding,
    );
    assert.equal(result.total, 200);
    assert.equal(result.status, "Mixed statuses");
    assert.equal(result.items[1].total, 0);
    assert.equal(result.businessName, "Little Shop");
    assert.ok(!JSON.stringify(result).includes("987.65"));
    assert.ok(!("cost" in result.items[0]));
    assert.ok(!("fee" in result.items[0]));
});
test("downloaded customer HTML escapes editable content and contains no private estimates", () => {
    const html = customerOrderHtml(
        [
            {
                ...order,
                customer: '<script>alert("name")</script>',
                productName: "<img src=x onerror=alert(1)>",
            },
        ],
        { ...branding, businessName: "<script>brand</script>" },
    );
    assert.ok(!html.includes("<script>"));
    assert.ok(!html.includes("<img src=x"));
    assert.ok(html.includes("&lt;script&gt;"));
    assert.ok(!html.includes("987.65"));
    assert.ok(!html.includes("324.78"));
    assert.ok(!html.includes("Platform fees"));
    assert.ok(!html.includes("Estimated order profit"));
    assert.ok(!html.includes("https://ajmission.dev"));
    assert.ok(!html.includes("Made with care by"));
    assert.ok(!html.includes("<footer>"));
});
test("all-cancelled summaries show zero total and keep cancellation visible", () => {
    const result = customerOrderSummary([{ ...order, status: "Cancelled" }], null);
    assert.equal(result.total, 0);
    assert.equal(result.status, "Cancelled");
    assert.throws(() => customerOrderSummary([], null));
});
