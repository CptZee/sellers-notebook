import test from "node:test";
import assert from "node:assert/strict";
import {
    supplierStatement,
    statementSuppliers,
    supplierStatementCsv,
    supplierStatementHtml,
} from "../lib/supplier-statements.mjs";
const payment = {
    id: "paid",
    amount: 200,
    date: "2026-11-05",
    method: "Cash",
    reference: "PRIVATE-REFERENCE",
    notes: "PRIVATE-NOTES",
};
const order = {
    id: "one",
    reference: "PO-ONE",
    supplierId: "s1",
    supplierName: "Paper studio",
    createdAt: "2026-11-05T18:00:00Z",
    status: "Ordered",
    items: [
        { productId: "p1", productName: "Notebook", sku: "NOTE-1", quantity: 5, unitCost: 100 },
    ],
    payments: [payment],
};
const cancelled = {
    ...order,
    id: "two",
    reference: "PO-TWO",
    status: "Cancelled",
    items: [{ ...order.items[0], receivedQuantity: 1 }],
    supplierRefunds: [{ ...payment, id: "refund", amount: 40 }],
};
test("supplier statements keep unpaid balances and credits separate without netting purchases", () => {
    const input = [order, cancelled],
        before = structuredClone(input),
        statement = supplierStatement(input);
    assert.deepEqual(statement.totals, {
        originalTotal: 1000,
        itemTotal: 600,
        paid: 400,
        refunded: 40,
        netPaid: 360,
        balance: 300,
        credit: 60,
    });
    assert.equal(statement.rows[0].date, "2026-11-06");
    assert.deepEqual(input, before);
});
test("filters match supplier IDs, historical supplier names, purchase refs and product SKUs", () => {
    const other = {
        ...order,
        id: "three",
        reference: "PO-THREE",
        supplierId: "s2",
        supplierName: "Other studio",
    };
    assert.equal(supplierStatement([order, cancelled, other], { supplierId: "s1" }).rows.length, 2);
    assert.equal(
        supplierStatement([order, cancelled, other], { status: "Cancelled", search: "note-1" })
            .totals.credit,
        60,
    );
    assert.equal(supplierStatement([order, other], { search: "paper studio" }).rows.length, 1);
    assert.equal(supplierStatement([order, other], { search: "po-three" }).rows[0].id, "three");
    assert.equal(supplierStatement([order], { search: "missing" }).totals.balance, 0);
});
test("removed suppliers remain selectable without merging same-name suppliers", () => {
    const options = statementSuppliers([{ id: "s2", name: "Paper studio" }], [order]);
    assert.equal(options.length, 2);
    assert.equal(options.find((s) => s.id === "s1").archived, true);
    assert.equal(options.find((s) => s.id === "s2").archived, false);
});
test("statement CSV exports every matching record, quotes unsafe cells, and omits private transaction details", () => {
    const orders = Array.from({ length: 30 }, (_, i) => ({
        ...order,
        id: String(i),
        reference: "PO-" + i,
    }));
    const csv = supplierStatementCsv(supplierStatement(orders).rows);
    assert.equal(csv.split("\r\n").length, 31);
    assert.doesNotMatch(csv, /PRIVATE-REFERENCE|PRIVATE-NOTES/);
    const unsafe = supplierStatement([{ ...order, supplierName: '=HYPERLINK("bad")' }]).rows;
    assert.match(supplierStatementCsv(unsafe), /'=HYPERLINK\(""bad""\)/);
    const pennies = supplierStatement([
        { ...order, items: [{ ...order.items[0], unitCost: 0.1, quantity: 3 }], payments: [] },
    ]);
    assert.equal(pennies.totals.balance, 0.3);
});
test("branded statement copies include all matching pages and keep private transactions and maker credit out", () => {
    const orders = Array.from({ length: 30 }, (_, i) => ({
        ...order,
        id: String(i),
        reference: "PO-" + i,
    }));
    const html = supplierStatementHtml(
        orders,
        { supplierId: "s1" },
        [],
        { businessName: "Paper shop", tagline: "A little business" },
        new Date("2026-11-05T18:30:00Z"),
    );
    assert.match(html, /Paper shop/);
    assert.match(html, /A little business/);
    assert.match(html, /Archived supplier/);
    assert.match(html, /Matching purchases:<\/strong> 30/);
    assert.match(html, /PO-29/);
    assert.match(html, /Asia\/Manila/);
    assert.match(html, /Nov 6, 2026/);
    assert.doesNotMatch(html, /PRIVATE-REFERENCE|PRIVATE-NOTES|ajmission|<footer|<script/i);
    assert.equal((html.match(/<tr>/g) || []).length, 31);
});
test("printed statement totals preserve separate balances/credits and follow supplier/status/search filters", () => {
    const html = supplierStatementHtml(
        [order, cancelled],
        { status: "Cancelled", search: "po-two" },
        [],
        null,
        new Date("2026-11-06"),
    );
    assert.match(html, /PO-TWO/);
    assert.doesNotMatch(html, /PO-ONE/);
    assert.match(html, /₱60\.00/);
    assert.match(html, /Search filter:<\/strong> po-two/);
    assert.match(html, /Balances and credits remain separate/);
});
test("HTML-like statement fields and filter descriptions render as escaped text without active resources", () => {
    const html = supplierStatementHtml(
        [
            {
                ...order,
                supplierName: "<img src=x onerror=alert(1)>",
                reference: "<script>bad</script>",
            },
        ],
        { search: "" },
        [],
        { businessName: "<b>Shop</b>", tagline: "A&B" },
    );
    assert.match(html, /&lt;script&gt;/);
    assert.match(html, /A&amp;B/);
    assert.doesNotMatch(html, /<script|<img|<iframe|<link|<footer/i);
});
