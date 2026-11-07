import test from "node:test";
import assert from "node:assert/strict";
import {
    restockPurchaseDraft,
    restockDraftVersion,
    restockIncomingPlan,
    restockIncomingCsv,
    filterRestockPlan,
} from "../lib/restock-purchase.mjs";
const product = {
    id: "p",
    name: "Paper",
    sku: "P-1",
    stock: 3,
    cost: 0.1,
    reorderPoint: 5,
    targetStock: 20,
};
const supplier = { id: "s", name: "Studio", productIds: ["p"] };
const purchase = {
    id: "po",
    supplierId: "other",
    status: "Partially received",
    items: [{ productId: "p", quantity: 10, receivedQuantity: 4, unitCost: 0.2 }],
};
test("restock drafts subtract outstanding units across suppliers, exclude closed purchases and leave source data unchanged", () => {
    const products = [product, { ...product, id: "unlinked" }],
        orders = [
            purchase,
            { ...purchase, id: "closed", status: "Cancelled" },
            { ...purchase, id: "done", status: "Received" },
        ],
        before = structuredClone({ products, orders, supplier });
    const draft = restockPurchaseDraft(supplier, products, orders);
    assert.equal(draft.supplierId, "s");
    assert.deepEqual(draft.lines, [{ productId: "p", quantity: 11, unitCost: 0.1 }]);
    assert.equal(draft.version, restockDraftVersion(supplier, products, orders));
    assert.deepEqual({ products, orders, supplier }, before);
});
test("fully covered and unlinked plans cannot create empty purchases; line limits never silently truncate", () => {
    assert.throws(() => restockPurchaseDraft(undefined, [product], []), /supplier/);
    assert.throws(
        () =>
            restockPurchaseDraft(
                supplier,
                [product],
                [{ ...purchase, items: [{ productId: "p", quantity: 20 }] }],
            ),
        /No additional/,
    );
    assert.throws(
        () => restockPurchaseDraft(supplier, [{ ...product, stock: 30 }], []),
        /No additional/,
    );
    const products = Array.from({ length: 101 }, (_, i) => ({ ...product, id: String(i) }));
    assert.throws(
        () =>
            restockPurchaseDraft(
                { ...supplier, productIds: products.map((p) => p.id) },
                products,
                [],
            ),
        /100/,
    );
});
test("draft checkpoints detect changes to planning inputs while payment-only updates remain safe", () => {
    const version = restockDraftVersion(supplier, [product], [purchase]);
    for (const [s, p, o] of [
        [{ ...supplier, productIds: [] }, [product], [purchase]],
        [supplier, [{ ...product, stock: 4 }], [purchase]],
        [supplier, [{ ...product, cost: 2 }], [purchase]],
        [supplier, [product], [{ ...purchase, status: "Cancelled" }]],
        [
            supplier,
            [product],
            [{ ...purchase, items: [{ ...purchase.items[0], receivedQuantity: 5 }] }],
        ],
    ])
        assert.notEqual(restockDraftVersion(s, p, o), version);
    assert.equal(
        restockDraftVersion(supplier, [product], [{ ...purchase, payments: [{ amount: 1 }] }]),
        version,
    );
});
test("incoming restock rows show partial outstanding units and clamp additional buying at zero without hiding covered stock alerts", () => {
    const products = [
            product,
            { ...product, id: "covered" },
            { ...product, id: "healthy", stock: 30 },
        ],
        orders = [
            purchase,
            {
                ...purchase,
                id: "coverage",
                items: [{ productId: "covered", quantity: 25, receivedQuantity: 0 }],
            },
        ],
        before = structuredClone({ products, orders });
    const rows = restockIncomingPlan(products, orders),
        row = rows.find((item) => item.id === "p"),
        covered = rows.find((item) => item.id === "covered");
    assert.equal(rows.length, 2);
    assert.equal(row.quantity, 17);
    assert.equal(row.onOrder, 6);
    assert.equal(row.toBuy, 11);
    assert.equal(row.buyEstimate, 1.1);
    assert.equal(covered.onOrder, 25);
    assert.equal(covered.toBuy, 0);
    assert.equal(covered.buyEstimate, 0);
    assert.deepEqual({ products, orders }, before);
    assert.equal(
        restockIncomingPlan(
            [product],
            [
                { ...purchase, status: "Received" },
                { ...purchase, status: "Cancelled" },
            ],
        )[0].onOrder,
        0,
    );
});
test("incoming restock CSV keeps every row, reconciles cents and quotes unsafe names while excluding private purchase records", () => {
    const products = Array.from({ length: 30 }, (_, i) => ({
            ...product,
            id: String(i),
            name: i ? "Paper" : " =DANGEROUS()",
            sku: 'P,"1"',
        })),
        rows = restockIncomingPlan(products, []);
    const csv = restockIncomingCsv(rows, [
        {
            ...supplier,
            name: 'Studio, "one"',
            productIds: ["0"],
            leadTimeDays: 2,
            notes: "PRIVATE",
        },
    ]);
    assert.equal(csv.charCodeAt(0), 0xfeff);
    assert.equal(csv.split("\r\n").length, 31);
    assert.ok(csv.includes("On order (all suppliers)"));
    assert.ok(csv.includes('"1.70"'));
    assert.ok(csv.includes('"\' =DANGEROUS()"'));
    assert.ok(csv.includes('"Studio, ""one"""'));
    assert.ok(!csv.includes("PRIVATE"));
});
test("restock view/search/supplier filters combine without changing incoming calculations or including unrelated draft lines", () => {
    const products = [
            product,
            { ...product, id: "covered", name: "Covered paper" },
            { ...product, id: "unlinked", sku: "OTHER" },
        ],
        orders = [{ ...purchase, items: [{ productId: "covered", quantity: 30 }] }],
        suppliers = [{ ...supplier, productIds: ["p", "covered"] }],
        plan = restockIncomingPlan(products, orders),
        before = structuredClone(plan);
    assert.deepEqual(
        filterRestockPlan(plan, suppliers, {
            supplierId: "s",
            view: "Needs buying",
            search: " p-1 ",
        }).map((p) => p.id),
        ["p"],
    );
    assert.deepEqual(
        filterRestockPlan(plan, suppliers, { view: "Covered by incoming stock" }).map((p) => p.id),
        ["covered"],
    );
    assert.deepEqual(
        filterRestockPlan(plan, suppliers, { supplierId: "unlinked" }).map((p) => p.id),
        ["unlinked"],
    );
    assert.equal(filterRestockPlan(plan, suppliers, { search: "absent" }).length, 0);
    assert.deepEqual(plan, before);
    assert.deepEqual(
        restockPurchaseDraft(
            { ...supplier, productIds: ["p", "unlinked"] },
            products,
            [],
            ["unlinked"],
        ).lines.map((line) => line.productId),
        ["unlinked"],
    );
    assert.throws(() => restockPurchaseDraft(supplier, products, [], []), /No additional/);
});
