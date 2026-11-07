import { goodsReturn, voidGoodsReturn, addGoodsReturnRefund } from "./supplier-returns.mjs";
import { canonicalJson } from "./notebook-patch.mjs";
import { createPurchase, receivePurchase } from "./purchases.mjs";
import { reschedulePurchase, purchaseScheduleVersion } from "./delivery-reminders.mjs";
import {
    addPurchasePayment,
    addSupplierRefund,
    removePurchasePayment,
} from "./purchase-payments.mjs";
export function purchaseCommand(document, command) {
    if (
        !command ||
        ![
            "goods-return",
            "void-goods-return",
            "goods-return-refund",
            "remove-goods-return-refund",
            "create",
            "receive",
            "cancel",
            "schedule",
            "payment",
            "refund",
            "remove-payment",
            "remove-refund",
        ].includes(command.kind) ||
        typeof command.id !== "string" ||
        !command.id ||
        command.id.length > 100 ||
        Object.keys(command).some(
            (key) => !["kind", "id", "expected", "input", "entryId", "revision"].includes(key),
        )
    )
        throw Error("Invalid purchase command.");
    const { kind, id, expected, input, entryId } = command,
        orders = document.purchaseOrders || [],
        products = document.products || [];
    if (kind === "create") {
        const supplier = (document.suppliers || []).find((s) => s.id === expected?.id);
        if (!supplier || canonicalJson(supplier) !== canonicalJson(expected))
            throw Error("This supplier changed. Reselect it and review its linked products.");
        if (orders.some((order) => order.id === id))
            throw Error("This purchase is already recorded. Review the latest list.");
        if (
            !input ||
            Object.keys(input).some((key) => !["lines", "notes", "expectedDate"].includes(key)) ||
            !Array.isArray(input.lines) ||
            input.lines.length > 100
        )
            throw Error("Choose up to 100 linked purchase items.");
        const generated = createPurchase(
                supplier,
                input.lines,
                products,
                input.notes,
                input.expectedDate,
            ),
            order = {
                ...generated,
                id,
                reference: `PO-${new Date(generated.createdAt).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" })}-${id.slice(0, 8)}`,
            };
        return { purchaseOrders: { remove: [], upsert: [{ index: 0, record: order }] } };
    }
    const index = orders.findIndex((order) => order.id === id),
        current = orders[index];
    if (!current || canonicalJson(current) !== canonicalJson(expected))
        throw Error("This purchase changed. Reopen the entry and review its latest records.");
    let next,
        changes = {};
    if (kind === "goods-return" || kind === "void-goods-return") {
        const result =
                kind === "goods-return"
                    ? goodsReturn(
                          current,
                          products,
                          document.stockAdjustments || [],
                          input,
                          entryId,
                      )
                    : voidGoodsReturn(
                          current,
                          products,
                          document.stockAdjustments || [],
                          input?.returnId,
                      ),
            added = result.stockAdjustments.length - (document.stockAdjustments || []).length;
        next = result.order;
        changes.products = {
            remove: [],
            upsert: result.products.flatMap((record, index) =>
                record !== products[index] ? [{ index, record }] : [],
            ),
        };
        changes.stockAdjustments = {
            remove: [],
            upsert: result.stockAdjustments
                .slice(0, added)
                .map((record, index) => ({ index, record })),
        };
    } else if (kind === "goods-return-refund") next = addGoodsReturnRefund(current, input, entryId);
    else if (kind === "remove-goods-return-refund") {
        if (!current.goodsReturnRefunds?.some((r) => r.id === input?.recordId))
            throw Error("This return refund was removed.");
        next = {
            ...current,
            goodsReturnRefunds: current.goodsReturnRefunds.filter((r) => r.id !== input.recordId),
        };
    } else if (kind === "receive") {
        if (
            input !== undefined &&
            (!input ||
                typeof input !== "object" ||
                Array.isArray(input) ||
                Object.keys(input).some((key) => key !== "delivery") ||
                (Object.hasOwn(input, "delivery") &&
                    (!input.delivery ||
                        typeof input.delivery !== "object" ||
                        Array.isArray(input.delivery))))
        )
            throw Error("Invalid delivery quantities.");
        const received = receivePurchase(
                current,
                products,
                document.stockAdjustments || [],
                input?.delivery,
            ),
            added = received.stockAdjustments.length - (document.stockAdjustments || []).length;
        next = received.order;
        changes.products = {
            remove: [],
            upsert: received.products.flatMap((record, index) =>
                record !== products[index] ? [{ index, record }] : [],
            ),
        };
        changes.stockAdjustments = {
            remove: [],
            upsert: received.stockAdjustments
                .slice(0, added)
                .map((record, index) => ({ index, record })),
        };
    } else if (kind === "cancel") {
        if (!["Ordered", "Partially received"].includes(current.status))
            throw Error("Only outstanding purchases can be cancelled.");
        next = { ...current, status: "Cancelled", cancelledAt: new Date().toISOString() };
    } else if (kind === "schedule")
        next = reschedulePurchase(current, input?.date, purchaseScheduleVersion(current));
    else if (kind === "payment" || kind === "refund") {
        if (typeof entryId !== "string" || !entryId || entryId.length > 100)
            throw Error("Invalid financial record identity.");
        const field = kind === "payment" ? "payments" : "supplierRefunds";
        if ((current[field] || []).some((record) => record.id === entryId))
            throw Error("This financial record is already saved. Review the latest history.");
        next =
            kind === "payment"
                ? addPurchasePayment(current, input)
                : addSupplierRefund(current, input);
        next = {
            ...next,
            [field]: next[field].map((record, index) =>
                index === next[field].length - 1 ? { ...record, id: entryId } : record,
            ),
        };
    } else {
        const field = kind === "remove-payment" ? "payments" : "supplierRefunds",
            recordId = input?.recordId;
        if (
            typeof recordId !== "string" ||
            !(current[field] || []).some((record) => record.id === recordId)
        )
            throw Error("This financial record was removed. Refresh the latest history.");
        next =
            kind === "remove-payment"
                ? removePurchasePayment(current, recordId)
                : {
                      ...current,
                      supplierRefunds: current.supplierRefunds.filter(
                          (record) => record.id !== recordId,
                      ),
                  };
    }
    return { ...changes, purchaseOrders: { remove: [], upsert: [{ index, record: next }] } };
}
