export function pricing(
    cost: number,
    packaging: number,
    shipping: number,
    fee: number,
    margin: number,
    tax?: number,
): { price: number; profit: number; fees: number; taxes: number; base: number } | null;
export function orderTotals(order: {
    price: number;
    quantity: number;
    cost: number;
    fee: number;
    packaging: number;
    shipping: number;
}): { revenue: number; expense: number; profit: number };
