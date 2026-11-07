import type { Order, Product } from "./notebook-types";
export function transitionOrders(
    orders: Order[],
    products: Product[],
    ids: string[],
    action: "Completed" | "Cancelled",
): { orders: Order[]; products: Product[]; count: number };
export function filterOrderList(
    orders: Order[],
    products: Product[],
    search?: string,
    status?: string,
    sort?: string,
): Order[];
