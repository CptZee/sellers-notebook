"use client";
import { useEffect, useState } from "react";
import { Stat } from "./stat";
import type { Product, Supplier, PurchaseOrder } from "../lib/notebook-types";
type Summary = {
    revision: number;
    inventory: { units: number; value: number; lowCount: number };
    suppliers: { count: number; open: number; due: number };
};
export function NotebookPageOverview({
    kind,
    userId,
    revision,
    ready,
    products,
    suppliers,
    purchases,
    today,
}: {
    kind: "Inventory" | "Suppliers";
    userId?: string;
    revision: number;
    ready: boolean;
    products: Product[];
    suppliers: Supplier[];
    purchases: PurchaseOrder[];
    today: string;
}) {
    const key = JSON.stringify([userId, revision]),
        [state, setState] = useState<{ key: string; data?: Summary; error?: string }>({ key: "" }),
        [attempt, setAttempt] = useState(0);
    useEffect(() => {
        if (!userId || !ready) return;
        const controller = new AbortController();
        void fetch("/api/notebook/overview?revision=" + revision, {
            cache: "no-store",
            headers: { "X-Notebook-User": userId },
            signal: controller.signal,
        })
            .then(async (response) => {
                const result = await response.json();
                if (!response.ok) throw Error(result.error || "Could not load your overview.");
                if (!controller.signal.aborted) setState({ key, data: result });
            })
            .catch((error) => {
                if (!controller.signal.aborted) setState({ key, error: error.message });
            });
        return () => controller.abort();
    }, [userId, revision, key, ready, attempt]);
    const open = purchases.filter((p) => ["Ordered", "Partially received"].includes(p.status));
    const local = {
        inventory: {
            units: products.reduce((sum, p) => sum + p.stock, 0),
            value: products.reduce((sum, p) => sum + p.stock * p.cost, 0),
            lowCount: products.filter((p) => p.stock <= (p.reorderPoint ?? 10)).length,
        },
        suppliers: {
            count: suppliers.length,
            open: open.length,
            due: open.filter((p) => p.expectedDate && p.expectedDate <= today).length,
        },
    };
    const data = userId ? (ready && state.key === key ? state.data : undefined) : local,
        error = state.key === key ? state.error : undefined;
    const count = (value: number | undefined) =>
            value === undefined ? "—" : value.toLocaleString("en-PH"),
        money = (value: number | undefined) =>
            value === undefined
                ? "—"
                : new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
                      value,
                  );
    return (
        <section
            aria-label={`${kind} overview`}
            className="notebook-page-overview"
            aria-busy={!!userId && !data && !error}
        >
            <p className="overview-scope">
                {kind === "Inventory"
                    ? "Current stock across your full product collection."
                    : "Current supplier and delivery totals across your notebook."}{" "}
                Search, channel, and sales-date filters do not change these totals.
            </p>
            <div className="stats three">
                {kind === "Inventory" ? (
                    <>
                        <Stat
                            label="Units on hand"
                            value={count(data?.inventory.units)}
                            detail="Current stock across all products"
                            icon="stock"
                        />
                        <Stat
                            label="Stock value"
                            value={money(data?.inventory.value)}
                            detail="Units on hand × recorded unit cost"
                            icon="stock"
                        />
                        <Stat
                            label="Low-stock products"
                            value={count(data?.inventory.lowCount)}
                            detail="At or below their stock alert level"
                            icon="low"
                        />
                    </>
                ) : (
                    <>
                        <Stat
                            label="Suppliers"
                            value={count(data?.suppliers.count)}
                            detail="Contacts saved in your notebook"
                            icon="suppliers"
                        />
                        <Stat
                            label="Open purchases"
                            value={count(data?.suppliers.open)}
                            detail="Ordered or partially received"
                            icon="purchases"
                        />
                        <Stat
                            label="Deliveries due"
                            value={count(data?.suppliers.due)}
                            detail="Due today or overdue · Asia/Manila"
                            icon="deliveries"
                        />
                    </>
                )}
            </div>
            {userId && !data && (
                <p
                    className="overview-status"
                    role={error ? "alert" : "status"}
                >
                    {error ||
                        (!ready
                            ? "Waiting for your notebook to finish saving…"
                            : "Updating your notebook overview…")}
                    {error && (
                        <button
                            className="text-button"
                            onClick={() => {
                                setState({ key: "" });
                                setAttempt((value) => value + 1);
                            }}
                        >
                            Retry overview
                        </button>
                    )}
                </p>
            )}
        </section>
    );
}
