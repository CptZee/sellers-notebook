import type { Product, Supplier, PurchaseOrder, StockAdjustment } from "./notebook-types";
export function validPurchaseOrders(records: unknown, products: Product[]): boolean;
export function createPurchase(
    supplier: Supplier | undefined,
    lines: { productId: string; quantity: number; unitCost: number }[],
    products: Product[],
    notes?: string,
    expectedDate?: string,
): PurchaseOrder;
export function receivePurchase(
    order: PurchaseOrder,
    products: Product[],
    history: StockAdjustment[],
    delivery?: Record<string, number>,
): { order: PurchaseOrder; products: Product[]; stockAdjustments: StockAdjustment[] };

export function receivedUnits(order: PurchaseOrder, item: PurchaseOrder["items"][number]): number;
export function purchaseProgress(order: PurchaseOrder): string;
