"use client";
import { SectionSummary } from "./section-summary";
import { useEffect, useState } from "react";
import type { CloudNotebook } from "../lib/use-notebook-view";
import { Pagination } from "./pagination";
import { PurchaseEntry, type PurchaseSeed } from "./purchase-entry";
type Item = {
    id: string;
    name: string;
    sku: string;
    stock: number;
    reorderPoint: number;
    targetStock: number;
    quantity: number;
    onOrder: number;
    toBuy: number;
    buyEstimate: number;
    suppliers: { id: string; name: string; leadTimeDays: number }[];
};
type Plan = {
    revision: number;
    lowCount: number;
    items: Item[];
    options: { id: string; name: string }[];
    total: number;
    quantity: number;
    incoming: number;
    estimate: number;
    page: number;
    pages: number;
    pageSize: number;
    start: number;
    end: number;
};
const money = (n: number) =>
    new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(n);
export function CloudRestock({
    cloud,
    onSave,
    onCreated,
    disabled,
    onAdjustStock,
}: {
    onAdjustStock?: () => void;
    cloud: CloudNotebook;
    onSave: (command: Record<string, unknown>) => Promise<void>;
    onCreated: () => void;
    disabled: boolean;
}) {
    const [open, setOpen] = useState(false),
        [supplier, setSupplier] = useState("all"),
        [view, setView] = useState("All low-stock products"),
        [search, setSearch] = useState(""),
        [page, setPage] = useState(1),
        [size, setSize] = useState(25),
        [attempt, setAttempt] = useState(0),
        [busy, setBusy] = useState(false),
        [error, setError] = useState(""),
        [seed, setSeed] = useState<PurchaseSeed>();
    const params = new URLSearchParams({
            revision: String(cloud.revision),
            supplierId: supplier,
            view,
            search,
            page: String(page),
            size: String(size),
        }),
        key = JSON.stringify([cloud.userId, params.toString()]),
        [state, setState] = useState<{ key: string; data?: Plan; error?: string }>({ key: "" }),
        data = state.key === key ? state.data : undefined;
    useEffect(() => {
        if (!open) return;
        const controller = new AbortController();
        void fetch("/api/notebook/restock?" + params, {
            cache: "no-store",
            headers: { "X-Notebook-User": cloud.userId },
            signal: controller.signal,
        })
            .then(async (response) => {
                const result = await response.json();
                if (!response.ok) throw Error(result.error || "Could not open restock plan.");
                if (!controller.signal.aborted) setState({ key, data: result });
            })
            .catch((e) => {
                if (!controller.signal.aborted) setState({ key, error: e.message });
            });
        return () => controller.abort();
    }, [key, open, attempt]);
    async function action(mode: "csv" | "draft") {
        setBusy(true);
        setError("");
        try {
            const response = await fetch("/api/notebook/restock?" + params + "&mode=" + mode, {
                cache: "no-store",
                headers: { "X-Notebook-User": cloud.userId },
            });
            if (!response.ok)
                throw Error((await response.json()).error || "Could not prepare restock records.");
            if (mode === "draft") {
                setSeed(await response.json());
                return;
            }
            const url = URL.createObjectURL(await response.blob()),
                a = document.createElement("a");
            a.href = url;
            a.download = "restock-plan.csv";
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not prepare restock records.");
        } finally {
            setBusy(false);
        }
    }
    return (
        <>
            {seed && (
                <PurchaseEntry
                    seed={seed}
                    cloud={cloud}
                    onSave={async (command) => {
                        await onSave(command);
                        onCreated();
                    }}
                    onClose={() => setSeed(undefined)}
                    disabled={disabled}
                />
            )}
            <details
                className="card restock-plan"
                onToggle={(e) => setOpen(e.currentTarget.open)}
            >
                <SectionSummary
                    title="Restock planner"
                    description={
                        <>
                            {" "}
                            {data
                                ? `${data.lowCount} products at their alert level`
                                : "Open to check low-stock products"}{" "}
                        </>
                    }
                />
                {open && (
                    <div className="restock-plan-body">
                        {onAdjustStock && (
                            <div className="restock-adjust-action">
                                <p>
                                    Need to update quantities already on hand? Record a stock
                                    adjustment.
                                </p>
                                <button
                                    type="button"
                                    className="button secondary"
                                    disabled={disabled}
                                    onClick={onAdjustStock}
                                >
                                    New stock adjustment
                                </button>
                            </div>
                        )}
                        <p className="import-note">
                            Current stock, incoming purchases and additional units needed across all
                            channels. Incoming units become available only when received.
                        </p>
                        <div className="restock-filters">
                            <label className="field">
                                <span>Restock supplier</span>
                                <select
                                    aria-label="Restock supplier"
                                    value={supplier}
                                    onChange={(e) => {
                                        setSupplier(e.target.value);
                                        setPage(1);
                                    }}
                                >
                                    <option value="all">All suppliers</option>
                                    <option value="unlinked">No supplier linked</option>
                                    {data?.options.map((s) => (
                                        <option
                                            key={s.id}
                                            value={s.id}
                                        >
                                            {s.name}
                                        </option>
                                    ))}
                                    {supplier !== "all" &&
                                        supplier !== "unlinked" &&
                                        !data?.options.some((s) => s.id === supplier) && (
                                            <option value={supplier}>Selected supplier</option>
                                        )}
                                </select>
                            </label>
                            <label className="field">
                                <span>Restock view</span>
                                <select
                                    aria-label="Restock view"
                                    value={view}
                                    onChange={(e) => {
                                        setView(e.target.value);
                                        setPage(1);
                                    }}
                                >
                                    {[
                                        "All low-stock products",
                                        "Needs buying",
                                        "Covered by incoming stock",
                                    ].map((v) => (
                                        <option key={v}>{v}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="field">
                                <span>Search restock products</span>
                                <input
                                    aria-label="Search restock products"
                                    maxLength={200}
                                    value={search}
                                    onChange={(e) => {
                                        setSearch(e.target.value);
                                        setPage(1);
                                    }}
                                />
                            </label>
                        </div>
                        {!data ? (
                            <p role="status">
                                {(state.key === key && state.error) || "Opening restock plan…"}
                                {state.key === key && state.error && (
                                    <button
                                        className="text-button"
                                        onClick={() => setAttempt((n) => n + 1)}
                                    >
                                        Retry restock plan
                                    </button>
                                )}
                            </p>
                        ) : (
                            <>
                                <div className="restock-summary">
                                    <span>
                                        {data.incoming} units on order · {data.quantity} additional
                                        units to buy · estimated item cost {money(data.estimate)}
                                    </span>
                                    <button
                                        className="button secondary"
                                        disabled={disabled || busy || !data.total}
                                        onClick={() => void action("csv")}
                                    >
                                        Export restock plan
                                    </button>
                                    <button
                                        className="button primary"
                                        disabled={
                                            disabled ||
                                            busy ||
                                            !Number(data.quantity) ||
                                            ["all", "unlinked"].includes(supplier)
                                        }
                                        onClick={() => void action("draft")}
                                    >
                                        Prepare purchase order
                                    </button>
                                </div>
                                <p className="import-note">
                                    Filters apply to totals, exports and drafts across every page.
                                    Drafts allow up to 100 products. Estimates use inventory unit
                                    costs and exclude delivery, taxes and supplier price changes.
                                </p>
                                <div className="table-scroll">
                                    <table>
                                        <thead>
                                            <tr>
                                                {[
                                                    "Product / SKU",
                                                    "Supplier options",
                                                    "Current stock",
                                                    "Alert at",
                                                    "Target",
                                                    "Stock shortfall",
                                                    "On order",
                                                    "Additional units to buy",
                                                    "Additional item estimate",
                                                ].map((h) => (
                                                    <th key={h}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.items.map((i) => (
                                                <tr key={i.id}>
                                                    <td>
                                                        {i.name}
                                                        <small>{i.sku}</small>
                                                    </td>
                                                    <td>
                                                        {i.suppliers.map((s) => (
                                                            <div key={s.id}>
                                                                {s.name}
                                                                <small>
                                                                    {s.leadTimeDays
                                                                        ? `${s.leadTimeDays} day lead time`
                                                                        : "Lead time unspecified"}
                                                                </small>
                                                            </div>
                                                        ))}
                                                        {!i.suppliers.length &&
                                                            "No supplier linked"}
                                                    </td>
                                                    <td>{i.stock}</td>
                                                    <td>{i.reorderPoint}</td>
                                                    <td>{i.targetStock}</td>
                                                    <td>{i.quantity}</td>
                                                    <td>{i.onOrder}</td>
                                                    <td>{i.toBuy}</td>
                                                    <td>{money(i.buyEstimate)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {!data.total && (
                                        <p className="empty">
                                            No low-stock products match these filters.
                                        </p>
                                    )}
                                    <Pagination
                                        label="Restock plan"
                                        {...data}
                                        setPage={setPage}
                                        setPageSize={(n) => {
                                            setSize(n);
                                            setPage(1);
                                        }}
                                    />
                                </div>
                            </>
                        )}
                        {error && (
                            <p
                                className="auth-error"
                                role="alert"
                            >
                                {error}
                            </p>
                        )}
                    </div>
                )}
            </details>
        </>
    );
}
