import type { PurchaseOrder, Branding } from "./notebook-types";
export function isPurchaseOverdue(order: PurchaseOrder, today: string): boolean;
export function purchaseOverview(
    orders: PurchaseOrder[],
    today: string,
): { openCount: number; overdueCount: number; outstandingUnits: number; outstandingCost: number };
export function purchaseCopySummary(
    order: PurchaseOrder,
    branding: Branding | null,
): {
    businessName: string;
    tagline: string;
    reference: string;
    supplierName: string;
    status: string;
    date: string;
    expectedDate: string;
    items: {
        productName: string;
        sku: string;
        quantity: number;
        received: number;
        outstanding: number;
        cancelled: number;
        unitCost: number;
        total: number;
    }[];
    total: number;
    outstandingTotal: number;
};
export function purchaseCopyHtml(order: PurchaseOrder, branding: Branding | null): string;
