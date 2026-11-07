import { test } from "node:test";
import assert from "node:assert/strict";
import { readShopeeCsv, previewShopeeImport } from "../lib/shopee-import.mjs";
import { validDocument } from "../lib/notebook-validation.mjs";
import { orderTotals } from "../lib/finance.mjs";
const products = [
    {
        id: "p1",
        sku: "MUG-1",
        name: "Mug",
        cost: 100,
        price: 300,
        stock: 10,
        color: "#eeeeee",
        category: "Home",
        symbol: "☕",
    },
    {
        id: "p2",
        sku: "TOTE-1",
        name: "Tote",
        cost: 80,
        price: 200,
        stock: 5,
        color: "#eeeeee",
        category: "Bags",
        symbol: "👜",
    },
];
const options = { fee: 10, packaging: 15, shipping: 20, dateFormat: "ISO" };
const csv =
    "Order ID,Seller SKU,Quantity,Unit Price,Order Date,Order Status,Buyer Username,Currency\nORDER-1,MUG-1,2,300,2026-11-05,Completed,Buyer,PHP\nORDER-1,TOTE-1,1,200,2026-11-05,Completed,Buyer,PHP\n";
const preview = async (text = csv, existing = [], opts = options) => {
    const data = readShopeeCsv(text);
    return previewShopeeImport(data.rows, data.mapping, products, existing, opts);
};
test("one order with two SKUs counts fulfillment costs once and leaves stock untouched", async () => {
    const result = await preview();
    assert.deepEqual(result.errors, []);
    assert.equal(result.orders.length, 2);
    assert.ok(result.orders.every((o) => o.stockApplied === false));
    assert.equal(products[0].stock, 10);
    assert.equal(
        result.orders.reduce((n, o) => n + o.packaging + o.shipping, 0),
        35,
    );
    assert.equal(
        result.orders.reduce((n, o) => n + orderTotals(o).profit, 0),
        405,
    );
    assert.equal(validDocument({ products, orders: result.orders }), true);
});
test("stable source identifiers skip previously imported orders", async () => {
    const first = await preview();
    const second = await preview(csv, first.orders);
    assert.equal(second.duplicates, 2);
    assert.equal(second.orders.length, 0);
});
test("repeated source order and SKU within the same file must be resolved", async () => {
    const duplicate = csv + csv.split("\n")[1] + "\n";
    const result = await preview(duplicate);
    assert.match(result.errors[0].message, /twice/);
});
test("unknown inventory SKUs and non-PHP currency block import", async () => {
    const missing = await preview(csv.replace("MUG-1", "UNKNOWN"));
    assert.match(missing.errors[0].message, /No inventory product/);
    const foreign = await preview(csv.replace(",PHP", ",USD"));
    assert.match(foreign.errors[0].message, /PHP/);
});
test("quoted buyer names and UTF-8 BOM are parsed correctly", async () => {
    const result = await preview("\uFEFF" + csv.replace(",Buyer,PHP", ',"Buyer, Jr.",PHP'));
    assert.equal(result.orders[0].customer, "Buyer, Jr.");
});
test("invalid calendar dates and ambiguous dates do not import silently", async () => {
    const invalid = await preview(csv.replaceAll("2026-11-05", "2026-02-30"));
    assert.equal(invalid.errors.length, 2);
    const ambiguous = await preview(csv.replaceAll("2026-11-05", "05/11/2026"));
    assert.equal(ambiguous.errors.length, 2);
    const explicit = await preview(csv.replaceAll("2026-11-05", "05/11/2026"), [], {
        ...options,
        dateFormat: "DMY",
    });
    assert.equal(explicit.orders[0].date, "2026-11-05");
});
test("delivered remains processing; refunds need separate handling", async () => {
    const delivered = await preview(csv.replaceAll("Completed", "Delivered"));
    assert.equal(delivered.orders[0].status, "Processing");
    const refunded = await preview(csv.replaceAll("Completed", "Refunded"));
    assert.equal(refunded.errors.length, 2);
});
test("fee validation and missing mappings block the entire preview", async () => {
    const result = await preview(csv, [], { ...options, fee: 100 });
    assert.equal(result.orders.length, 0);
    assert.match(result.errors[0].message, /fee/);
    const data = readShopeeCsv(csv);
    data.mapping.price = "";
    const missing = await previewShopeeImport(data.rows, data.mapping, products, [], options);
    assert.equal(missing.orders.length, 0);
});
test("additional lines of an already imported order do not re-charge fulfillment costs", async () => {
    const data = readShopeeCsv(csv);
    const first = await previewShopeeImport(
        data.rows.slice(0, 1),
        data.mapping,
        products,
        [],
        options,
    );
    const second = await previewShopeeImport(
        data.rows.slice(1),
        data.mapping,
        products,
        first.orders,
        options,
    );
    assert.equal(second.orders[0].packaging + second.orders[0].shipping, 0);
});

test("marketplace imports isolate identical external order IDs and costs by channel", async () => {
    const data = readShopeeCsv(csv),
        all = [];
    for (const platform of ["Shopee", "Lazada", "TikTok Shop"]) {
        const result = await previewShopeeImport(
            data.rows,
            data.mapping,
            products,
            all,
            options,
            platform,
        );
        assert.deepEqual(result.errors, []);
        assert.equal(result.orders.length, 2);
        assert.ok(result.orders.every((o) => o.channel === platform && o.stockApplied === false));
        assert.equal(
            result.orders.reduce((n, o) => n + o.packaging + o.shipping, 0),
            35,
        );
        assert.equal(validDocument({ products, orders: result.orders }), true);
        all.push(...result.orders);
        const repeated = await previewShopeeImport(
            data.rows,
            data.mapping,
            products,
            all,
            options,
            platform,
        );
        assert.equal(repeated.duplicates, 2);
        assert.equal(repeated.orders.length, 0);
    }
    assert.equal(new Set(all.map((o) => o.id)).size, 6);
});
test("Lazada and TikTok additional lines do not charge fulfillment costs again", async () => {
    const data = readShopeeCsv(csv);
    for (const platform of ["Lazada", "TikTok Shop"]) {
        const first = await previewShopeeImport(
            data.rows.slice(0, 1),
            data.mapping,
            products,
            [],
            options,
            platform,
        );
        const next = await previewShopeeImport(
            data.rows.slice(1),
            data.mapping,
            products,
            first.orders,
            options,
            platform,
        );
        assert.equal(next.orders[0].packaging + next.orders[0].shipping, 0);
    }
});
test("marketplace header aliases and conservative shipment status mapping work", async () => {
    const data = readShopeeCsv(
        "order_id,seller_sku,Quantity,unit_price,created_time,order_status\nA1,MUG-1,1,200,2026-11-05,Awaiting Shipment\n",
    );
    const result = await previewShopeeImport(
        data.rows,
        data.mapping,
        products,
        [],
        options,
        "TikTok Shop",
    );
    assert.deepEqual(result.errors, []);
    assert.equal(result.orders[0].status, "Processing");
});
