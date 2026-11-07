import type { PurchaseOrder, Product, StockAdjustment } from "./notebook-types";
export function returnedUnits(order: PurchaseOrder, productId: string): number;
export function returnCreditCents(order: PurchaseOrder, date?: string): number;
export function returnCashCents(order: PurchaseOrder, date?: string): number;
export function returnRefundAvailable(order: PurchaseOrder, date?: string): number;
export function cancelRefundAvailable(order: PurchaseOrder): number;
export function validGoodsReturns(order: PurchaseOrder, today?: string): boolean;
export function validGoodsReturnRefunds(order: PurchaseOrder, today?: string): boolean;
export function goodsReturn(
    order: PurchaseOrder,
    products: Product[],
    history: StockAdjustment[],
    input: unknown,
    id: string,
): { order: PurchaseOrder; products: Product[]; stockAdjustments: StockAdjustment[] };
export function voidGoodsReturn(
    order: PurchaseOrder,
    products: Product[],
    history: StockAdjustment[],
    id: string,
): { order: PurchaseOrder; products: Product[]; stockAdjustments: StockAdjustment[] };
export function addGoodsReturnRefund(
    order: PurchaseOrder,
    input: unknown,
    id: string,
): PurchaseOrder;
