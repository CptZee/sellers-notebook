import type { Product, Supplier, PurchaseOrder } from "./notebook-types";
export type RestockPurchaseDraft = {
    supplierId: string;
    lines: { productId: string; quantity: number; unitCost: number }[];
    version: string;
};
export function restockDraftVersion(
    supplier: Supplier | undefined,
    products: Product[],
    orders: PurchaseOrder[],
): string;
export function restockPurchaseDraft(
    supplier: Supplier | undefined,
    products: Product[],
    orders: PurchaseOrder[],
    productIds?: string[],
): RestockPurchaseDraft;
export function restockIncomingPlan(
    products: Product[],
    orders: PurchaseOrder[],
): (ReturnType<typeof import("./restock-plan.mjs").restockPlan>[number] & {
    onOrder: number;
    toBuy: number;
    buyEstimate: number;
})[];
export function restockIncomingCsv(
    plan: ReturnType<typeof restockIncomingPlan>,
    suppliers: Supplier[],
): string;
export function filterRestockPlan(
    plan: ReturnType<typeof restockIncomingPlan>,
    suppliers: Supplier[],
    filters?: { supplierId?: string; view?: string; search?: string },
): ReturnType<typeof restockIncomingPlan>;
