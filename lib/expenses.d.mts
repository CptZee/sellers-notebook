import type { Order, Expense, RefundRecord } from "./notebook-types";
export const expenseCategories: string[];
export function profitSummary(
    orders: Order[],
    expenses: Expense[],
    refunds?: RefundRecord[],
): {
    revenue: number;
    orderCosts: number;
    orderProfit: number;
    overhead: number;
    netProfit: number;
};
