import test from "node:test";
import assert from "node:assert/strict";
import {
    deliveryCategory,
    deliveryCounts,
    deliveryReminders,
    deliverySuppliers,
    deliveryRemindersCsv,
    purchaseScheduleVersion,
    reschedulePurchase,
} from "../lib/delivery-reminders.mjs";
const order = {
    id: "po",
    reference: "PO-1",
    supplierId: "s",
    supplierName: "Paper studio",
    createdAt: "2026-11-01T12:00:00Z",
    status: "Partially received",
    expectedDate: "2026-11-05",
    notes: "",
    items: [
        {
            productId: "p",
            productName: "Notebook",
            sku: "NB-1",
            quantity: 5,
            receivedQuantity: 2,
            unitCost: 0.1,
        },
    ],
};
test("delivery categories distinguish overdue/today/seven-day boundaries/missing dates and exclude closed purchases", () => {
    const today = "2026-11-06";
    assert.equal(deliveryCategory(order, today), "Overdue");
    for (const [date, category] of [
        ["2026-11-06", "Due today"],
        ["2026-11-07", "Next 7 days"],
        ["2026-11-13", "Next 7 days"],
        ["2026-11-14", "Later"],
        ["", "No date set"],
    ])
        assert.equal(deliveryCategory({ ...order, expectedDate: date }, today), category);
    for (const status of ["Received", "Cancelled"])
        assert.equal(deliveryCategory({ ...order, status }, today), "Closed");
    assert.equal(
        deliveryCategory({ ...order, expectedDate: "2027-01-01" }, "2026-12-31"),
        "Next 7 days",
    );
});
test("reminders use outstanding units/cents, filter/search and sort dated purchases before missing dates without mutations", () => {
    const orders = [
            { ...order, id: "missing", reference: "PO-0", expectedDate: "" },
            order,
            { ...order, id: "today", expectedDate: "2026-11-06" },
            { ...order, id: "closed", status: "Cancelled" },
        ],
        copy = structuredClone(orders);
    const rows = deliveryReminders(orders, "2026-11-06");
    assert.equal(rows.length, 3);
    assert.equal(rows[0].id, "po");
    assert.equal(rows[0].quantity, 3);
    assert.equal(rows[0].cost, 0.3);
    assert.equal(rows.at(-1).id, "missing");
    assert.deepEqual(orders, copy);
    assert.equal(
        deliveryReminders(orders, "2026-11-06", { filter: "Overdue", search: "NB-1" }).length,
        1,
    );
    assert.equal(deliveryReminders(orders, "2026-11-06", { search: "paper studio" }).length, 3);
    assert.equal(deliveryReminders(orders, "2026-11-06", { search: "missing" }).length, 0);
    assert.deepEqual(deliveryCounts(orders, "2026-11-06"), {
        Overdue: 1,
        "Due today": 1,
        "Next 7 days": 0,
        Later: 0,
        "No date set": 1,
    });
});
test("rescheduling and clearing dates preserve stock/payment data and reject stale or closed edits", () => {
    const current = {
            ...order,
            payments: [
                {
                    id: "p",
                    amount: 0.1,
                    date: "2026-11-01",
                    method: "Cash",
                    reference: "",
                    notes: "",
                },
            ],
        },
        before = structuredClone(current),
        version = purchaseScheduleVersion(current);
    const changed = reschedulePurchase(current, "2026-12-01", version);
    assert.equal(changed.expectedDate, "2026-12-01");
    assert.deepEqual(changed.items, current.items);
    assert.deepEqual(changed.payments, current.payments);
    assert.deepEqual(current, before);
    assert.equal(reschedulePurchase(current, "", version).expectedDate, "");
    assert.throws(() => reschedulePurchase(current, "2026-02-30", version));
    assert.throws(() => reschedulePurchase(changed, "2026-12-02", version));
    assert.throws(() => reschedulePurchase({ ...current, status: "Received" }, "", version));
});

test("supplier follow-up filters by identity, retains historical suppliers, and exports all matching rows safely", () => {
    const orders = Array.from({ length: 30 }, (_, i) => ({
        ...order,
        id: `po-${i}`,
        reference: i === 0 ? ' =HYPERLINK("unsafe")' : `PO-${i}`,
        supplierName: 'Same, "supplier"',
        supplierId: i < 28 ? "first" : "second",
        notes: "PRIVATE NOTE",
        payments: [{ reference: "PRIVATE PAYMENT" }],
    }));
    const before = structuredClone(orders),
        rows = deliveryReminders(orders, "2026-11-06", { supplierId: "first" });
    assert.equal(rows.length, 28);
    assert.equal(deliveryReminders(orders, "2026-11-06", { supplierId: "second" }).length, 2);
    assert.equal(deliveryReminders(orders, "2026-11-06", { supplierId: "removed" }).length, 0);
    assert.deepEqual(
        deliverySuppliers([...orders, { ...order, supplierId: "closed", status: "Received" }]).map(
            (s) => s.id,
        ),
        ["first", "second"],
    );
    const csv = deliveryRemindersCsv(rows);
    assert.equal(csv.charCodeAt(0), 0xfeff);
    assert.equal(csv.split("\r\n").length, 29);
    assert.ok(csv.includes('"0.30"'));
    assert.ok(csv.includes(`"' =HYPERLINK(""unsafe"")"`));
    assert.ok(csv.includes('"Same, ""supplier"""'));
    assert.ok(!csv.includes("PRIVATE"));
    assert.deepEqual(orders, before);
    assert.equal(deliveryRemindersCsv([]).split("\r\n").length, 1);
});
