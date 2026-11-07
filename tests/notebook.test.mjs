import { test } from "node:test";
import assert from "node:assert/strict";
import { validDocument } from "../lib/notebook-validation.mjs";
const product = {
    id: "p1",
    name: "Notebook",
    sku: "NOTE-1",
    category: "Stationery",
    cost: 50,
    price: 100,
    stock: 10,
    color: "#e2e9df",
    symbol: "📓",
};
test("a valid empty or stocked notebook is accepted", () => {
    assert.equal(validDocument({ products: [], orders: [] }), true);
    assert.equal(validDocument({ products: [product], orders: [] }), true);
});
test("duplicate products and SKUs are rejected", () => {
    assert.equal(
        validDocument({ products: [product, { ...product, id: "p2" }], orders: [] }),
        false,
    );
    assert.equal(
        validDocument({ products: [product, { ...product, sku: "OTHER" }], orders: [] }),
        false,
    );
});
test("invalid financial values and fractional stock are rejected", () => {
    for (const changes of [{ stock: -1 }, { stock: 1.5 }, { cost: NaN }, { price: Infinity }])
        assert.equal(validDocument({ products: [{ ...product, ...changes }], orders: [] }), false);
});
test("orders require a known product, valid date, and bounded fee", () => {
    const order = {
        id: "o1",
        productId: "p1",
        productName: "Notebook",
        customer: "Customer",
        channel: "Direct",
        quantity: 1,
        price: 100,
        cost: 50,
        fee: 0,
        packaging: 5,
        shipping: 0,
        date: "2026-11-05",
        status: "Completed",
    };
    assert.equal(validDocument({ products: [product], orders: [order] }), true);
    for (const changes of [
        { productId: "missing" },
        { date: "2026-02-30" },
        { fee: 100 },
        { quantity: 0 },
    ])
        assert.equal(
            validDocument({ products: [product], orders: [{ ...order, ...changes }] }),
            false,
        );
});

test("personal notebook notes allow empty text and reject oversized or non-text values", () => {
    assert.equal(validDocument({ products: [], orders: [], sidebarNote: "" }), true);
    assert.equal(
        validDocument({ products: [], orders: [], sidebarNote: "A little reminder" }),
        true,
    );
    assert.equal(validDocument({ products: [], orders: [], sidebarNote: "x".repeat(201) }), false);
    assert.equal(validDocument({ products: [], orders: [], sidebarNote: 42 }), false);
});

test("branding permits reset and rejects invalid names, icons, and oversized text", () => {
    const branding = {
        businessName: "Little Shop",
        notebookTitle: "My Shop Journal",
        tagline: "Made with care",
        icon: "store",
    };
    for (const value of [branding, null])
        assert.equal(validDocument({ products: [], orders: [], branding: value }), true);
    for (const bad of [
        { ...branding, businessName: " " },
        { ...branding, notebookTitle: "" },
        { ...branding, icon: "arbitrary-html" },
        { ...branding, tagline: "x".repeat(101) },
        { ...branding, businessName: "x".repeat(49) },
    ])
        assert.equal(validDocument({ products: [], orders: [], branding: bad }), false);
});
