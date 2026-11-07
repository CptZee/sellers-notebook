"use client";
import { SectionSummary } from "./section-summary";
import { StockEntry } from "./stock-entry";
import { useState, useEffect, useRef } from "react";
import { useNotebookView, type CloudNotebook } from "../lib/use-notebook-view";
import { downloadView } from "../lib/view-download";
import { ViewLoading } from "./view-loading";
import { stockChange } from "../lib/stock-adjustments.mjs";
import { Pagination } from "./pagination";
import { usePagination } from "../lib/use-pagination";
import type { Product, StockAdjustment } from "../lib/notebook-types";
export function StockAdjustments({
    products,
    history,
    onApply,
    disabled,
    cloud,
    prepareEntry,
    onSaveTargeted,
    openRequest = 0,
}: {
    openRequest?: number;
    onSaveTargeted?: (command: Record<string, unknown>) => Promise<void>;
    cloud?: CloudNotebook;
    prepareEntry?: () => Promise<unknown>;
    products: Product[];
    history: StockAdjustment[];
    onApply: (change: StockAdjustment) => void;
    disabled: boolean;
}) {
    const [expanded, setExpanded] = useState(false);
    const [entryOpen, setEntryOpen] = useState(false);
    const panel = useRef<HTMLDetailsElement>(null),
        form = useRef<HTMLFormElement>(null);
    useEffect(() => {
        if (!openRequest) return;
        if (panel.current) panel.current.open = true;
        setExpanded(true);
        setEntryOpen(true);
    }, [openRequest]);
    useEffect(() => {
        if (!expanded || !entryOpen) return;
        const frame = requestAnimationFrame(() => {
            if (!cloud || cloud.hydrated) {
                form.current?.scrollIntoView({ block: "center", behavior: "instant" });
                form.current
                    ?.querySelector<HTMLSelectElement>("select")
                    ?.focus({ preventScroll: true });
            }
        });
        return () => cancelAnimationFrame(frame);
    }, [expanded, entryOpen, openRequest, cloud?.hydrated]);
    const [selected, setSelected] = useState(""),
        [baseline, setBaseline] = useState(0),
        [kind, setKind] = useState<StockAdjustment["kind"]>("Restock"),
        [quantity, setQuantity] = useState(""),
        [reason, setReason] = useState(""),
        [error, setError] = useState("");
    const product = products.find((p) => p.id === selected),
        changed = !!product && product.stock !== baseline;
    const after = product
        ? kind === "Restock"
            ? product.stock + Number(quantity)
            : kind === "Damage"
              ? product.stock - Number(quantity)
              : Number(quantity)
        : null;
    async function exportHistory() {
        if (cloud) {
            try {
                await downloadView(cloud, "stock");
            } catch (e) {
                setError(e instanceof Error ? e.message : "Download failed.");
            }
            return;
        }
        const rows = [
            ["Date", "Product", "SKU", "Type", "Before", "After", "Change", "Reason"],
            ...history.map((item) => [
                item.createdAt,
                item.productName,
                item.sku,
                item.kind,
                item.before,
                item.after,
                item.after - item.before,
                item.reason,
            ]),
        ];
        const csv = rows
            .map((row) =>
                row
                    .map(
                        (value) =>
                            '"' +
                            (typeof value === "number"
                                ? String(value)
                                : String(value).replace(/^[=+@-]/, "'$&")
                            ).replaceAll('"', '""') +
                            '"',
                    )
                    .join(","),
            )
            .join("\r\n");
        const url = URL.createObjectURL(
            new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }),
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = "stock-adjustment-history.csv";
        link.click();
        URL.revokeObjectURL(url);
    }

    const view = useNotebookView<StockAdjustment>(cloud, "stock", {}, expanded),
        localPaging = usePagination(history),
        paging = cloud ? { ...view.paging, items: view.items } : localPaging,
        total = cloud ? view.total : history.length;
    return (
        <>
            {entryOpen && cloud && onSaveTargeted && (
                <StockEntry
                    cloud={cloud}
                    onSave={onSaveTargeted}
                    onClose={() => setEntryOpen(false)}
                    disabled={disabled}
                />
            )}
            <details
                ref={panel}
                className="card stock-adjustments"
                onToggle={(e) => setExpanded(e.currentTarget.open)}
            >
                <SectionSummary
                    title="Stock adjustments"
                    description={
                        <>
                            {" "}
                            {cloud ? cloud.counts?.stockAdjustments || 0 : history.length} recorded
                            changes{" "}
                        </>
                    }
                />
                {expanded && (
                    <div className="stock-adjustment-body">
                        <p className="import-note">
                            Record restocks, damaged items, or a stock-count correction. This
                            history tracks manual quantity adjustments, separately from sales and
                            CSV imports. It does not record spending.
                        </p>
                        <div className="stock-entry-action">
                            <button
                                type="button"
                                className="button primary"
                                disabled={disabled}
                                onClick={() => {
                                    setError("");
                                    setEntryOpen(true);
                                    form.current
                                        ?.querySelector<HTMLSelectElement>("select")
                                        ?.focus();
                                }}
                            >
                                New stock adjustment
                            </button>
                            <small>
                                Restock, damage, or correct a count. This changes stock, not
                                expenses.
                            </small>
                        </div>
                        <>
                            {cloud && !cloud.hydrated ? null : (
                                <form
                                    ref={form}
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        setError("");
                                        try {
                                            if (changed)
                                                throw Error(
                                                    "Stock changed on another device. Reselect this product before continuing.",
                                                );
                                            if (history.length >= 10000)
                                                throw Error(
                                                    "The adjustment history has reached its 10,000-entry limit.",
                                                );
                                            const change = stockChange(
                                                product!,
                                                kind,
                                                quantity === "" ? NaN : Number(quantity),
                                                reason,
                                            );
                                            onApply(change);
                                            paging.setPage(1);
                                            setSelected("");
                                            setQuantity("");
                                            setReason("");
                                        } catch (e) {
                                            setError(
                                                e instanceof Error
                                                    ? e.message
                                                    : "Could not adjust stock.",
                                            );
                                        }
                                    }}
                                >
                                    <fieldset disabled={disabled}>
                                        <label className="field">
                                            <span>Adjustment product</span>
                                            <select
                                                required
                                                aria-label="Adjustment product"
                                                value={selected}
                                                onChange={(e) => {
                                                    setSelected(e.target.value);
                                                    setBaseline(
                                                        products.find(
                                                            (p) => p.id === e.target.value,
                                                        )?.stock || 0,
                                                    );
                                                    setError("");
                                                }}
                                            >
                                                <option value="">Choose a product</option>
                                                {products.map((p) => (
                                                    <option
                                                        key={p.id}
                                                        value={p.id}
                                                    >
                                                        {p.name} · {p.sku}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                        <label className="field">
                                            <span>Adjustment type</span>
                                            <select
                                                aria-label="Adjustment type"
                                                value={kind}
                                                onChange={(e) =>
                                                    setKind(
                                                        e.target.value as StockAdjustment["kind"],
                                                    )
                                                }
                                            >
                                                <option>Restock</option>
                                                <option>Damage</option>
                                                <option>Correction</option>
                                            </select>
                                        </label>
                                        <label className="field">
                                            <span>
                                                {kind === "Correction"
                                                    ? "Correct stock count"
                                                    : "Units to adjust"}
                                            </span>
                                            <input
                                                required
                                                type="number"
                                                min={kind === "Correction" ? 0 : 1}
                                                max={10000000}
                                                step={1}
                                                value={quantity}
                                                onChange={(e) => setQuantity(e.target.value)}
                                            />
                                        </label>
                                        <label className="field">
                                            <span>Reason for adjustment</span>
                                            <input
                                                required
                                                maxLength={200}
                                                value={reason}
                                                onChange={(e) => setReason(e.target.value)}
                                            />
                                        </label>
                                    </fieldset>
                                    {product && quantity !== "" && (
                                        <p className="import-note">
                                            Current stock: {product.stock} → New stock: {after}
                                        </p>
                                    )}
                                    {changed && (
                                        <p
                                            className="auth-error"
                                            role="alert"
                                        >
                                            Stock changed on another device. Reselect this product
                                            before continuing.
                                        </p>
                                    )}
                                    <div className="stock-adjustment-actions">
                                        <button
                                            className="button primary"
                                            disabled={disabled || changed || !product}
                                            type="submit"
                                        >
                                            Record stock adjustment
                                        </button>
                                    </div>
                                </form>
                            )}
                        </>
                        {error && (
                            <p
                                className="auth-error"
                                role="alert"
                            >
                                {error}
                            </p>
                        )}
                        {cloud && view.pending && (
                            <ViewLoading
                                error={view.error}
                                retry={view.retry}
                            />
                        )}
                        <div className="stock-history-heading">
                            <h2>Manual adjustment history</h2>
                            <button
                                type="button"
                                className="text-button"
                                disabled={!total || (!!cloud && view.pending)}
                                onClick={exportHistory}
                            >
                                Export stock history
                            </button>
                        </div>
                        {total ? (
                            <div className="table-scroll">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Product / SKU</th>
                                            <th>Type</th>
                                            <th>Before → After</th>
                                            <th>Reason</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paging.items.map((item) => (
                                            <tr key={item.id}>
                                                <td>
                                                    {new Date(item.createdAt).toLocaleString(
                                                        "en-PH",
                                                        { timeZone: "Asia/Manila" },
                                                    )}
                                                </td>
                                                <td>
                                                    {item.productName}
                                                    <small>{item.sku}</small>
                                                </td>
                                                <td>{item.kind}</td>
                                                <td>
                                                    {item.before} → {item.after}
                                                </td>
                                                <td className="stock-reason">{item.reason}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <Pagination
                                    label="Stock history"
                                    {...paging}
                                />
                            </div>
                        ) : (
                            !view.pending && (
                                <p className="empty">Manual stock changes will appear here.</p>
                            )
                        )}
                    </div>
                )}
            </details>
        </>
    );
}
