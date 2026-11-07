import type { Product, StockAdjustment } from "./notebook-types";
export function stockChange(
    product: Product,
    kind: StockAdjustment["kind"],
    quantity: number,
    reason: string,
): StockAdjustment;
