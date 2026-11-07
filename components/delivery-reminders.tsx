"use client";
import { SectionSummary } from "./section-summary";
import { useState, useEffect, useRef } from "react";
import { useNotebookView, type CloudNotebook } from "../lib/use-notebook-view";
import { downloadView } from "../lib/view-download";
import { ViewLoading } from "./view-loading";
import { Pagination } from "./pagination";
import { usePagination } from "../lib/use-pagination";
import {
    deliveryCounts,
    deliveryReminders,
    deliverySuppliers,
    deliveryRemindersCsv,
} from "../lib/delivery-reminders.mjs";
import type { PurchaseOrder } from "../lib/notebook-types";
export function DeliveryReminders({
    orders,
    today,
    openRequest,
    onPurchase,
    onStatement,
    cloud,
}: {
    cloud?: CloudNotebook;
    orders: PurchaseOrder[];
    today: string;
    openRequest: number;
    onPurchase: (id: string, action: "view" | "receive") => void;
    onStatement: (id: string) => void;
}) {
    const [expanded, setExpanded] = useState(false),
        panel = useRef<HTMLDetailsElement>(null),
        counts = deliveryCounts(orders, today);
    useEffect(() => {
        if (!openRequest) return;
        setExpanded(true);
        if (panel.current) panel.current.open = true;
        const timer = setTimeout(
            () => panel.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
            0,
        );
        return () => clearTimeout(timer);
    }, [openRequest]);
    return (
        <details
            ref={panel}
            className="card delivery-reminders"
            onToggle={(event) => setExpanded(event.currentTarget.open)}
        >
            <SectionSummary
                title="Delivery reminders"
                description={
                    <>
                        {" "}
                        {cloud && !cloud.hydrated
                            ? "Open to review upcoming deliveries"
                            : `${counts.Overdue} overdue · ${counts["Due today"]} due today`}{" "}
                    </>
                }
            />
            {expanded && (
                <ReminderContents
                    orders={orders}
                    today={today}
                    onPurchase={onPurchase}
                    onStatement={onStatement}
                    cloud={cloud}
                />
            )}
        </details>
    );
}
function ReminderContents({
    orders,
    today,
    onPurchase,
    onStatement,
    cloud,
}: Omit<Parameters<typeof DeliveryReminders>[0], "openRequest">) {
    const [filter, setFilter] = useState("All open"),
        [search, setSearch] = useState(""),
        [supplierId, setSupplierId] = useState("all"),
        [error, setError] = useState("");
    const view = useNotebookView<ReturnType<typeof deliveryReminders>[number]>(cloud, "reminders", {
            status: filter,
            search,
            supplierId,
        }),
        localRows = deliveryReminders(orders, today, { filter, search, supplierId }),
        localPaging = usePagination(localRows, JSON.stringify([filter, search, supplierId]));
    const rows = cloud ? view.items : localRows,
        paging = cloud ? { ...view.paging, items: rows } : localPaging,
        counts = cloud ? view.counts : deliveryCounts(orders, today),
        suppliers = cloud ? view.options : deliverySuppliers(orders),
        total = cloud ? view.total : rows.length;
    const exportCsv = async () => {
        if (cloud) {
            try {
                await downloadView(cloud, "reminders", { status: filter, search, supplierId });
            } catch (e) {
                setError(e instanceof Error ? e.message : "Download failed.");
            }
            return;
        }
        const url = URL.createObjectURL(
                new Blob([deliveryRemindersCsv(rows)], { type: "text/csv;charset=utf-8" }),
            ),
            link = document.createElement("a");
        link.href = url;
        link.download = `delivery-follow-up-${today}.csv`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    return (
        <div className="delivery-reminder-body">
            <p className="import-note">
                Expected dates use Asia/Manila. Record arrivals to keep outstanding units up to
                date. Missing dates appear separately; closed purchases are excluded.
            </p>
            <div className="purchase-overview delivery-counts">
                {["Overdue", "Due today", "Next 7 days", "No date set"].map((label) => (
                    <div key={label}>
                        <small>{label}</small>
                        <strong>{counts[label]}</strong>
                    </div>
                ))}
            </div>
            <div className="delivery-reminder-filters">
                <label className="field">
                    <span>Delivery supplier</span>
                    <select
                        aria-label="Delivery supplier"
                        value={supplierId}
                        onChange={(event) => setSupplierId(event.target.value)}
                    >
                        <option value="all">All suppliers</option>
                        {suppliers.map((supplier) => (
                            <option
                                key={supplier.id}
                                value={supplier.id}
                            >
                                {supplier.name}
                                {suppliers.filter((option) => option.name === supplier.name)
                                    .length > 1
                                    ? ` · ${supplier.id.slice(-8)}`
                                    : ""}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="field">
                    <span>Delivery view</span>
                    <select
                        aria-label="Delivery view"
                        value={filter}
                        onChange={(event) => setFilter(event.target.value)}
                    >
                        {[
                            "All open",
                            "Overdue",
                            "Due today",
                            "Next 7 days",
                            "Later",
                            "No date set",
                        ].map((value) => (
                            <option key={value}>{value}</option>
                        ))}
                    </select>
                </label>
                <label className="field">
                    <span>Search deliveries</span>
                    <input
                        aria-label="Search deliveries"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Purchase, supplier, product or SKU"
                    />
                </label>
            </div>
            <div className="supplier-actions">
                <button
                    className="button secondary"
                    disabled={!rows.length}
                    onClick={exportCsv}
                >
                    Export delivery follow-up
                </button>
                <small>
                    {rows.length} matching purchases ·{" "}
                    {rows.reduce((total, row) => total + row.quantity, 0)} outstanding units
                </small>
            </div>
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
            <div className="table-scroll">
                <table>
                    <thead>
                        <tr>
                            <th>Purchase / supplier</th>
                            <th>Expected</th>
                            <th>Reminder</th>
                            <th>Outstanding units</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paging.items.map((row) => (
                            <tr key={row.id}>
                                <td>
                                    <strong>{row.reference}</strong>
                                    <small>{row.supplierName}</small>
                                </td>
                                <td>{row.expectedDate || "Not set"}</td>
                                <td>{row.category}</td>
                                <td>{row.quantity}</td>
                                <td>
                                    <div className="row-actions">
                                        <button
                                            className="text-button"
                                            onClick={() => onPurchase(row.id, "view")}
                                        >
                                            Open purchase
                                        </button>
                                        <button
                                            className="text-button"
                                            onClick={() => onPurchase(row.id, "receive")}
                                        >
                                            Record delivery
                                        </button>
                                        <button
                                            className="text-button"
                                            onClick={() => onStatement(row.supplierId)}
                                        >
                                            Statement
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {!rows.length && !view.pending && (
                    <p className="empty">No outstanding deliveries match this view.</p>
                )}
            </div>
            <Pagination
                label="Delivery reminders"
                {...paging}
            />
            <p className="import-note">
                Summary counts cover all open purchases. Supplier, view, and search filters apply to
                the list and export across every page. Item estimates exclude tax and delivery;
                private notes and payment records are omitted. Open a purchase to set or change its
                expected date.
            </p>
        </div>
    );
}
