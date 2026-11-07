export const notebookCollections = {
    products: 3000,
    orders: 15000,
    expenses: 10000,
    stockAdjustments: 10000,
    refundRecords: 10000,
    suppliers: 1000,
    purchaseOrders: 3000,
};
export const notebookPageSize = 100;
export function parseNotebookPage(params) {
    const collection = params.get("collection"),
        revision = params.get("revision"),
        offset = params.get("offset") ?? "0",
        limit = params.get("limit") ?? String(notebookPageSize);
    if (
        !Object.hasOwn(notebookCollections, collection) ||
        ![revision, offset, limit].every(
            (value) => typeof value === "string" && /^(0|[1-9]\d*)$/.test(value),
        )
    )
        throw Error("Invalid notebook page.");
    const result = {
        collection,
        revision: Number(revision),
        offset: Number(offset),
        limit: Number(limit),
    };
    if (
        !Object.values(result)
            .filter((value) => typeof value === "number")
            .every(Number.isSafeInteger) ||
        result.limit < 1 ||
        result.limit > notebookPageSize ||
        result.offset > notebookCollections[collection]
    )
        throw Error("Invalid notebook page.");
    return result;
}
