"use client";
import { useState } from "react";
import { CheckCircle2, FlaskConical } from "lucide-react";
import { pricing, orderTotals } from "../lib/finance.mjs";
import { stockChange } from "../lib/stock-adjustments.mjs";
import type { ExerciseKind } from "../lib/notebook-tour-steps";

type Product = {
    id: string;
    name: string;
    sku: string;
    cost: number;
    price: number;
    stock: number;
    reorderPoint: number;
    category: string;
    color: string;
    symbol: string;
};
export type PracticeState = {
    product?: Product;
    order?: {
        quantity: number;
        fee: number;
        packaging: number;
        status: "Processing" | "Completed";
        refunded: number;
    };
    expense: number;
    supplier?: string;
    purchase?: { quantity: number; received: number; unitCost: number; paid: number };
    results: Partial<Record<ExerciseKind, string>>;
};
export const emptyPractice = (): PracticeState => ({ expense: 0, results: {} });
const money = (n: number) =>
    new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(n);
type Field = {
    name: string;
    label: string;
    value: string | number;
    type?: "number";
    max?: number;
    min?: number;
    step?: string;
};
const fields: Record<ExerciseKind, Field[]> = {
    product: [
        { name: "name", label: "Practice product name", value: "Practice everyday tote" },
        { name: "sku", label: "Practice SKU", value: "PRACTICE-TOTE-01" },
        {
            name: "cost",
            label: "Practice unit cost (₱)",
            value: 80,
            type: "number",
            min: 0,
            max: 100000000,
            step: "0.01",
        },
        {
            name: "price",
            label: "Practice selling price (₱)",
            value: 150,
            type: "number",
            min: 0,
            max: 100000000,
            step: "0.01",
        },
        {
            name: "stock",
            label: "Practice opening stock",
            value: 20,
            type: "number",
            min: 0,
            max: 10000000,
        },
    ],
    stock: [
        {
            name: "quantity",
            label: "Practice units to add",
            value: 5,
            type: "number",
            min: 1,
            max: 10000000,
        },
        {
            name: "reason",
            label: "Practice adjustment reason",
            value: "Practice opening stock delivery",
        },
    ],
    sale: [
        {
            name: "quantity",
            label: "Practice sale quantity",
            value: 2,
            type: "number",
            min: 1,
            max: 10000000,
        },
        {
            name: "fee",
            label: "Practice platform fee (%)",
            value: 8,
            type: "number",
            min: 0,
            max: 99.99,
            step: "0.01",
        },
        {
            name: "packaging",
            label: "Practice packaging per order (₱)",
            value: 10,
            type: "number",
            min: 0,
            max: 100000000,
            step: "0.01",
        },
    ],
    complete: [],
    refund: [
        {
            name: "amount",
            label: "Practice customer refund (₱)",
            value: 20,
            type: "number",
            min: 0.01,
            max: 100000000,
            step: "0.01",
        },
    ],
    expense: [
        { name: "title", label: "Practice expense title", value: "Practice social ad campaign" },
        {
            name: "amount",
            label: "Practice overhead amount (₱)",
            value: 40,
            type: "number",
            min: 0.01,
            max: 100000000,
            step: "0.01",
        },
    ],
    supplier: [{ name: "name", label: "Practice supplier name", value: "Practice supply studio" }],
    purchase: [
        {
            name: "quantity",
            label: "Practice units to order",
            value: 5,
            type: "number",
            min: 1,
            max: 10000000,
        },
        {
            name: "cost",
            label: "Practice purchase unit cost (₱)",
            value: 80,
            type: "number",
            min: 0,
            max: 100000000,
            step: "0.01",
        },
    ],
    receive: [
        {
            name: "quantity",
            label: "Practice units received now",
            value: 3,
            type: "number",
            min: 1,
            max: 10000000,
        },
    ],
    payment: [
        {
            name: "amount",
            label: "Practice supplier payment (₱)",
            value: 100,
            type: "number",
            min: 0.01,
            max: 100000000,
            step: "0.01",
        },
    ],
    pricing: [
        {
            name: "cost",
            label: "Practice pricing unit cost (₱)",
            value: 80,
            type: "number",
            min: 0,
            max: 100000000,
            step: "0.01",
        },
        {
            name: "packaging",
            label: "Practice pricing packaging (₱)",
            value: 10,
            type: "number",
            min: 0,
            max: 100000000,
            step: "0.01",
        },
        {
            name: "shipping",
            label: "Practice pricing shipping (₱)",
            value: 0,
            type: "number",
            min: 0,
            max: 100000000,
            step: "0.01",
        },
        {
            name: "tax",
            label: "Practice tax allowance (%)",
            value: 2,
            type: "number",
            min: 0,
            max: 99.99,
            step: "0.01",
        },
        {
            name: "fee",
            label: "Practice pricing fee (%)",
            value: 8,
            type: "number",
            min: 0,
            max: 99.99,
            step: "0.01",
        },
        {
            name: "margin",
            label: "Practice target margin (%)",
            value: 30,
            type: "number",
            min: 0,
            max: 99.99,
            step: "0.01",
        },
    ],
};

function applyPractice(state: PracticeState, kind: ExerciseKind, form: FormData): PracticeState {
    if (state.results[kind]) return state;
    const text = (key: string) => {
        const value = String(form.get(key) || "").trim();
        if (!value || value.length > 200)
            throw Error("Fill in the practice fields using up to 200 characters.");
        return value;
    };
    const number = (key: string, whole = false, min = 0, max = 100000000) => {
        const raw = text(key),
            value = Number(raw);
        if (
            !Number.isFinite(value) ||
            value < min ||
            value > max ||
            (whole && !Number.isSafeInteger(value)) ||
            (!whole && Math.abs(value * 100 - Math.round(value * 100)) > 0.00001)
        )
            throw Error(
                whole
                    ? "Enter a valid whole quantity."
                    : "Enter a valid amount with up to two decimal places.",
            );
        return value;
    };
    const next = {
        ...state,
        product: state.product ? { ...state.product } : undefined,
        order: state.order ? { ...state.order } : undefined,
        purchase: state.purchase ? { ...state.purchase } : undefined,
        results: { ...state.results },
    };
    let result = "";
    switch (kind) {
        case "product":
            next.product = {
                id: "tour-practice-product",
                category: "Practice",
                color: "#edf1df",
                symbol: "bag",
                name: text("name"),
                sku: text("sku"),
                cost: number("cost"),
                price: number("price"),
                stock: number("stock", true, 0, 10000000),
                reorderPoint: 10,
            };
            result = `${next.product.name} is on your practice page: ${next.product.stock} units, ${money(next.product.cost)} cost and ${money(next.product.price)} selling price. No real product was created.`;
            break;
        case "stock": {
            if (!next.product) throw Error("Complete the practice product first.");
            const change = stockChange(
                next.product,
                "Restock",
                number("quantity", true, 1, 10000000),
                text("reason"),
            );
            next.product.stock = change.after;
            result = `Practice stock: ${change.before} → ${change.after}. The quantity changed; overhead and purchase payments did not.`;
            break;
        }
        case "sale": {
            if (!next.product) throw Error("Complete the practice product first.");
            const quantity = number("quantity", true, 1, 10000000);
            if (quantity > next.product.stock)
                throw Error("There are not enough practice units. Choose a smaller sale quantity.");
            next.product.stock -= quantity;
            next.order = {
                quantity,
                fee: number("fee", false, 0, 99.99),
                packaging: number("packaging"),
                status: "Processing",
                refunded: 0,
            };
            result = `${quantity} units reserved. Practice stock is ${next.product.stock}. The sale is Processing, so completed revenue is still ${money(0)}.`;
            break;
        }
        case "complete": {
            if (!next.product || !next.order) throw Error("Record the practice sale first.");
            next.order.status = "Completed";
            const total = orderTotals({ ...next.product, ...next.order, shipping: 0 });
            result = `Completed revenue: ${money(total.revenue)}. Recorded order costs: ${money(total.expense)}. Estimated order profit: ${money(total.profit)}. Stock stays at ${next.product.stock}.`;
            break;
        }
        case "refund": {
            if (!next.product || !next.order || next.order.status !== "Completed")
                throw Error("Complete the practice sale first.");
            const amount = number("amount", false, 0.01);
            const revenue = next.product.price * next.order.quantity;
            if (amount > revenue - next.order.refunded)
                throw Error("The refund cannot exceed the remaining practice sale value.");
            next.order.refunded += amount;
            result = `Recorded ${money(amount)} already refunded. Practice profit decreases by that amount. Stock stays at ${next.product.stock}; no money moved.`;
            break;
        }
        case "expense": {
            text("title");
            next.expense = number("amount", false, 0.01);
            result = `Recorded practice overhead: ${money(next.expense)}. This reduces estimated net profit without changing stock or supplier payments.`;
            break;
        }
        case "supplier": {
            if (!next.product) throw Error("Create the practice product first.");
            next.supplier = text("name");
            result = `${next.supplier} is linked to ${next.product.name} in this practice tour. No message or purchase was sent.`;
            break;
        }
        case "purchase": {
            if (!next.supplier || !next.product) throw Error("Link your practice supplier first.");
            next.purchase = {
                quantity: number("quantity", true, 1, 10000000),
                received: 0,
                unitCost: number("cost"),
                paid: 0,
            };
            result = `${next.purchase.quantity} units on order for ${money(next.purchase.quantity * next.purchase.unitCost)}. Available practice stock is still ${next.product.stock}. Nothing has arrived or been paid yet.`;
            break;
        }
        case "receive": {
            if (!next.purchase || !next.product) throw Error("Create the practice purchase first.");
            const quantity = number("quantity", true, 1, 10000000);
            if (quantity > next.purchase.quantity - next.purchase.received)
                throw Error("Receive no more than the outstanding practice quantity.");
            if (next.product.stock + quantity > 10000000)
                throw Error("The practice stock limit would be exceeded.");
            next.purchase.received += quantity;
            next.product.stock += quantity;
            const remaining = next.purchase.quantity - next.purchase.received;
            result = `Received ${quantity} units. Practice stock is now ${next.product.stock}. ${remaining} units remain on order; the purchase is ${remaining ? "Partially received" : "Received"}. Payments did not change.`;
            break;
        }
        case "payment": {
            if (!next.purchase) throw Error("Create the practice purchase first.");
            const amount = number("amount", false, 0.01),
                balance = next.purchase.quantity * next.purchase.unitCost - next.purchase.paid;
            if (amount > balance)
                throw Error("The payment exceeds the remaining practice balance.");
            next.purchase.paid += amount;
            result = `Recorded ${money(amount)} already paid. Remaining practice item balance: ${money(balance - amount)}. No funds were transferred and stock did not change.`;
            break;
        }
        case "pricing": {
            const estimate = pricing(
                number("cost"),
                number("packaging"),
                number("shipping"),
                number("fee", false, 0, 99.99),
                number("margin", false, 0, 99.99),
                number("tax", false, 0, 99.99),
            );
            if (!estimate)
                throw Error("Fee, tax allowance and target margin must total less than 100%.");
            result = `Suggested practice price: ${money(estimate.price)}. Estimated profit per unit: ${money(estimate.profit)}. Your real product prices remain unchanged.`;
            break;
        }
    }
    next.results[kind] = result;
    return next;
}

export function TourPractice({
    kind,
    state,
    onChange,
}: {
    kind: ExerciseKind;
    state: PracticeState;
    onChange: (value: PracticeState) => void;
}) {
    const [error, setError] = useState("");
    const result = state.results[kind];
    return (
        <div
            className="tour-practice"
            aria-label="Temporary practice notebook"
        >
            <div className="tour-practice-label">
                <FlaskConical
                    size={16}
                    aria-hidden="true"
                />
                <strong>Practice only · never saved</strong>
            </div>
            {result ? (
                <div
                    className="tour-practice-result"
                    role="status"
                >
                    <CheckCircle2
                        size={18}
                        aria-hidden="true"
                    />
                    <p>{result}</p>
                </div>
            ) : (
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        try {
                            onChange(applyPractice(state, kind, new FormData(event.currentTarget)));
                            setError("");
                        } catch (error) {
                            setError(
                                error instanceof Error
                                    ? error.message
                                    : "Check the practice values.",
                            );
                        }
                    }}
                >
                    <div className="tour-practice-fields">
                        {fields[kind].map((field) => (
                            <label
                                className="field"
                                key={field.name}
                            >
                                <span>{field.label}</span>
                                <input
                                    name={field.name}
                                    type={field.type || "text"}
                                    defaultValue={field.value}
                                    min={field.min}
                                    max={field.max}
                                    step={field.step || "1"}
                                    maxLength={200}
                                    required
                                />
                            </label>
                        ))}
                    </div>
                    {error && (
                        <p
                            className="tour-practice-error"
                            role="alert"
                        >
                            {error}
                        </p>
                    )}
                    <button
                        type="submit"
                        className="button secondary"
                    >
                        {kind === "complete" ? "Complete practice sale" : "Apply practice step"}
                    </button>
                </form>
            )}
            <p className="tour-practice-disclaimer">
                These entries stay in this guide and disappear when it closes.
            </p>
        </div>
    );
}
