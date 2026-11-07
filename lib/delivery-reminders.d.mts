import type { PurchaseOrder } from "./notebook-types";
export function deliveryCategory(order: PurchaseOrder, today: string): string;
export function deliveryCounts(orders: PurchaseOrder[], today: string): Record<string, number>;
export function deliveryReminders(
    orders: PurchaseOrder[],
    today: string,
    filters?: { filter?: string; search?: string; supplierId?: string },
): {
    id: string;
    reference: string;
    supplierId: string;
    supplierName: string;
    expectedDate: string;
    status: string;
    category: string;
    quantity: number;
    cost: number;
}[];
export function purchaseScheduleVersion(order: PurchaseOrder): string;
export function reschedulePurchase(
    order: PurchaseOrder,
    date: string,
    expected: string,
): PurchaseOrder;

export function deliverySuppliers(orders: PurchaseOrder[]): { id: string; name: string }[];
export function deliveryRemindersCsv(rows: ReturnType<typeof deliveryReminders>): string;
