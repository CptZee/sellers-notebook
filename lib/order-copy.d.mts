import type { Order, Branding, RefundRecord } from "./notebook-types";
export function orderGroup(orders: Order[], id: string): Order[];
export function customerOrderSummary(
    lines: Order[],
    branding: Branding | null,
    refundRecords?: RefundRecord[],
): {
    refunded: number;
    businessName: string;
    notebookTitle: string;
    tagline: string;
    orderId: string;
    channel: string;
    customer: string;
    date: string;
    status: string;
    items: {
        productName: string;
        quantity: number;
        price: number;
        status: string;
        total: number;
    }[];
    total: number;
};
export function customerOrderHtml(
    lines: Order[],
    branding: Branding | null,
    refundRecords?: RefundRecord[],
): string;
