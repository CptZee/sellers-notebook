import type { Order, RefundRecord } from "./notebook-types";
export function refundTotal(records: RefundRecord[]): number;
export function createRefund(
    orders: Order[],
    records: RefundRecord[],
    input: { orderId: string; amount: number; date: string; reason: string },
    today?: string,
): RefundRecord;
