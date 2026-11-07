"use client";
import { SectionSummary } from "./section-summary";
import { useState, useEffect, useRef } from "react";
import { useNotebookView, type CloudNotebook } from "../lib/use-notebook-view";
import { downloadView, viewUrl } from "../lib/view-download";
import { ViewLoading } from "./view-loading";
import { Pagination } from "./pagination";
import { usePagination } from "../lib/use-pagination";
import {
    statementSuppliers,
    supplierStatement,
    supplierStatementCsv,
    supplierStatementHtml,
} from "../lib/supplier-statements.mjs";
import type { Supplier, PurchaseOrder, Branding } from "../lib/notebook-types";
const money = (n: number) =>
    new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(n || 0);
export function SupplierStatements({
    suppliers,
    orders,
    request,
    branding,
    cloud,
}: {
    cloud?: CloudNotebook;
    suppliers: Supplier[];
    orders: PurchaseOrder[];
    branding: Branding | null;
    request?: { id: string; sequence: number } | null;
}) {
    const [expanded, setExpanded] = useState(false),
        panel = useRef<HTMLDetailsElement>(null);
    useEffect(() => {
        if (!request) return;
        setExpanded(true);
        if (panel.current) panel.current.open = true;
        const timer = setTimeout(
            () => panel.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
            0,
        );
        return () => clearTimeout(timer);
    }, [request]);
    return (
        <details
            ref={panel}
            className="card supplier-statements"
            onToggle={(event) => setExpanded(event.currentTarget.open)}
        >
            <SectionSummary
                title="Supplier statements"
                description={
                    <>
                        {" "}
                        {cloud ? cloud.counts?.purchaseOrders || 0 : orders.length} recorded
                        purchases{" "}
                    </>
                }
            />
            {expanded && (
                <StatementContents
                    suppliers={suppliers}
                    orders={orders}
                    request={request}
                    branding={branding}
                    cloud={cloud}
                />
            )}
        </details>
    );
}
function StatementContents({
    suppliers,
    orders,
    request,
    branding,
    cloud,
}: {
    cloud?: CloudNotebook;
    suppliers: Supplier[];
    orders: PurchaseOrder[];
    branding: Branding | null;
    request?: { id: string; sequence: number } | null;
}) {
    const [supplierId, setSupplierId] = useState(request?.id || "all"),
        [status, setStatus] = useState("All statuses"),
        [search, setSearch] = useState("");
    useEffect(() => {
        if (request) {
            setSupplierId(request.id);
            setStatus("All statuses");
            setSearch("");
        }
    }, [request]);
    const view = useNotebookView<ReturnType<typeof supplierStatement>["rows"][number]>(
            cloud,
            "statements",
            { supplierId, status, search },
        ),
        local = supplierStatement(orders, { supplierId, status, search }),
        localPaging = usePagination(local.rows, [supplierId, status, search].join("|")),
        options = cloud ? view.options : statementSuppliers(suppliers, orders),
        statement = cloud ? { rows: view.items, totals: view.totals } : local,
        paging = cloud ? { ...view.paging, items: view.items } : localPaging,
        total = cloud ? view.total : local.rows.length;
    const [copyError, setCopyError] = useState("");
    function html() {
        return supplierStatementHtml(orders, { supplierId, status, search }, suppliers, branding);
    }
    async function cloudDownload(format: string) {
        try {
            await downloadView(cloud!, "statements", { supplierId, status, search }, format);
        } catch (e) {
            setCopyError(e instanceof Error ? e.message : "Download failed.");
        }
    }
    function downloadCopy() {
        if (cloud) {
            void cloudDownload("html");
            return;
        }
        const url = URL.createObjectURL(new Blob([html()], { type: "text/html;charset=utf-8" }));
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "supplier-statement.html";
        anchor.click();
        URL.revokeObjectURL(url);
    }
    async function printCopy() {
        setCopyError("");
        const popup = window.open("", "_blank", "width=1150,height=800");
        if (!popup) {
            setCopyError(
                "Allow the statement window to open, or download the statement copy instead.",
            );
            return;
        }
        popup.opener = null;
        try {
            let body = html();
            if (cloud) {
                const response = await fetch(
                    viewUrl(cloud, "statements", { supplierId, status, search }, "html"),
                    { cache: "no-store", headers: { "X-Notebook-User": cloud.userId } },
                );
                if (!response.ok)
                    throw Error(
                        "The statement changed or could not be loaded. Retry the latest view.",
                    );
                body = await response.text();
            }
            popup.document.write(body);
        } catch (e) {
            popup.close();
            setCopyError(e instanceof Error ? e.message : "Could not print statement.");
            return;
        }
        popup.document.close();
        popup.focus();
        popup.print();
    }
    function download() {
        if (cloud) {
            void cloudDownload("csv");
            return;
        }
        const url = URL.createObjectURL(
            new Blob([supplierStatementCsv(statement.rows)], { type: "text/csv;charset=utf-8" }),
        );
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "supplier-statement.csv";
        anchor.click();
        URL.revokeObjectURL(url);
    }
    return (
        <div className="supplier-statement-body">
            <p className="import-note">
                Current lifetime item records for the selected purchases, including all their
                recorded payments and refunds. Balances and credits stay separate; no settlement
                between purchases is assumed. Tax and delivery are excluded.
            </p>
            <div className="supplier-statement-filters">
                <label className="field">
                    <span>Statement supplier</span>
                    <select
                        aria-label="Statement supplier"
                        value={supplierId}
                        onChange={(event) => setSupplierId(event.target.value)}
                    >
                        <option value="all">All suppliers</option>
                        {supplierId !== "all" &&
                            !options.some((option) => option.id === supplierId) && (
                                <option value={supplierId}>Loading supplier…</option>
                            )}
                        {options.map((option) => (
                            <option
                                value={option.id}
                                key={option.id}
                            >
                                {option.name}
                                {option.archived ? " · Archived supplier" : ""}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="field">
                    <span>Statement status</span>
                    <select
                        aria-label="Statement status"
                        value={status}
                        onChange={(event) => setStatus(event.target.value)}
                    >
                        {[
                            "All statuses",
                            "Ordered",
                            "Partially received",
                            "Received",
                            "Cancelled",
                        ].map((value) => (
                            <option key={value}>{value}</option>
                        ))}
                    </select>
                </label>
                <label className="field">
                    <span>Search statement</span>
                    <input
                        aria-label="Search supplier statement"
                        placeholder="Purchase, supplier, product or SKU"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                </label>
            </div>
            <div className="purchase-overview supplier-statement-totals">
                <div>
                    <small>Recorded payments</small>
                    <strong>{money(statement.totals.paid)}</strong>
                </div>
                <div>
                    <small>Supplier refunds received</small>
                    <strong>{money(statement.totals.refunded)}</strong>
                </div>
                <div>
                    <small>Unrecorded item balance</small>
                    <strong>{money(statement.totals.balance)}</strong>
                </div>
                <div>
                    <small>Credit to review</small>
                    <strong>{money(statement.totals.credit)}</strong>
                </div>
            </div>
            <div className="supplier-statement-export">
                <span>{total} purchases · totals include every matching page</span>
                <button
                    className="button secondary"
                    disabled={!total || (!!cloud && view.pending)}
                    onClick={download}
                >
                    Export supplier statement
                </button>
                <button
                    className="button secondary"
                    disabled={!total || (!!cloud && view.pending)}
                    onClick={downloadCopy}
                >
                    Download statement copy
                </button>
                <button
                    className="button secondary"
                    disabled={!total || (!!cloud && view.pending)}
                    onClick={printCopy}
                >
                    Print supplier statement
                </button>
            </div>
            {copyError && (
                <p
                    className="auth-error"
                    role="alert"
                >
                    {copyError}
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
                            <th>Status</th>
                            <th>Item amount</th>
                            <th>Payments</th>
                            <th>Refunds</th>
                            <th>Net paid</th>
                            <th>Item balance</th>
                            <th>Credit</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paging.items.map((row) => (
                            <tr key={row.id}>
                                <td>
                                    <strong>{row.reference}</strong>
                                    <small>{row.supplierName}</small>
                                    <small>{row.date}</small>
                                </td>
                                <td>{row.status}</td>
                                <td>{money(row.itemTotal)}</td>
                                <td>{money(row.paid)}</td>
                                <td>{money(row.refunded)}</td>
                                <td>{money(row.netPaid)}</td>
                                <td>{money(row.balance)}</td>
                                <td>{money(row.credit)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {!statement.rows.length && !view.pending && (
                    <p className="empty">
                        No purchases match this statement. Try another supplier, status, or search.
                    </p>
                )}
            </div>
            <Pagination
                label="Supplier statement"
                {...paging}
            />
            <p className="import-note">
                This is a notebook reconciliation, not confirmation of supplier agreement or
                payment. Private payment references and notes are excluded from the export.
                Exporting makes no changes.
            </p>
        </div>
    );
}
