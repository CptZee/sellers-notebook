export const notebookCollections: Record<
    | "products"
    | "orders"
    | "expenses"
    | "stockAdjustments"
    | "refundRecords"
    | "suppliers"
    | "purchaseOrders",
    number
>;
export const notebookPageSize: number;
export function parseNotebookPage(params: URLSearchParams): {
    collection: keyof typeof notebookCollections;
    revision: number;
    offset: number;
    limit: number;
};
