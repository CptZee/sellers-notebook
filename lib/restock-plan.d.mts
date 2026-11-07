import type { Product } from "./notebook-types";
export function stockTargets(product: Product): { reorderPoint: number; targetStock: number };
export function restockPlan(products: Product[]): {
    id: string;
    name: string;
    sku: string;
    stock: number;
    reorderPoint: number;
    targetStock: number;
    quantity: number;
    unitCost: number;
    estimatedCost: number;
}[];
