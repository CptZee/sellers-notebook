import type { PurchaseOrder, PurchasePayment } from "./notebook-types";
export const paymentMethods: string[];
export function validPurchasePayments(
    records: unknown,
    totalCents: number,
    today?: string,
): boolean;
export function purchasePaymentSummary(order: PurchaseOrder): {
    originalTotal: number;
    itemTotal: number;
    paid: number;
    refunded: number;
    netPaid: number;
    balance: number;
    credit: number;
    recordable: number;
};
export function addPurchasePayment(
    order: PurchaseOrder,
    input: Omit<PurchasePayment, "id">,
    today?: string,
): PurchaseOrder;
export function purchasePaymentProgress(order: PurchaseOrder): string;

export function validSupplierRefunds(order: PurchaseOrder, today?: string): boolean;
export function addSupplierRefund(
    order: PurchaseOrder,
    input: Omit<PurchasePayment, "id">,
    today?: string,
): PurchaseOrder;
export function removePurchasePayment(order: PurchaseOrder, id: string): PurchaseOrder;
export function eligibleFinancialPurchases(
    orders: PurchaseOrder[],
    kind: "payment" | "supplier-refund",
): PurchaseOrder[];
