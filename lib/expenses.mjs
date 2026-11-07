import { orderTotals } from "./finance.mjs";
export const expenseCategories = [
    "Advertising",
    "Software",
    "Rent & utilities",
    "Office supplies",
    "Professional services",
    "Other",
];
export function profitSummary(orders, expenses, refunds = []) {
    const cents = (value) => Math.round(value * 100);
    const sales = orders.filter((order) => order.status === "Completed");
    const revenue = sales.reduce((total, order) => total + cents(orderTotals(order).revenue), 0);
    const orderCosts = sales.reduce((total, order) => total + cents(orderTotals(order).expense), 0);
    const overhead = expenses.reduce((total, expense) => total + cents(expense.amount), 0);
    return {
        revenue: revenue / 100,
        orderCosts: orderCosts / 100,
        orderProfit: (revenue - orderCosts) / 100,
        overhead: overhead / 100,
        netProfit:
            (revenue -
                orderCosts -
                overhead -
                refunds.reduce((total, refund) => total + cents(refund.amount), 0)) /
            100,
    };
}
