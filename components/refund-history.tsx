"use client";
import { useState } from "react";
import { useNotebookView, type CloudNotebook } from "../lib/use-notebook-view";
import type { RefundRecord } from "../lib/notebook-types";
import { downloadView } from "../lib/view-download";
import { ViewLoading } from "./view-loading";
import { Pagination } from "./pagination";
import { CollapsibleCard } from "./collapsible-card";
import { RotateCcw } from "lucide-react";
export function RefundHistory({
    cloud,
    onOpen,
}: {
    cloud: CloudNotebook;
    onOpen: (id: string) => void;
}) {
    const [expanded, setExpanded] = useState(false),
        [error, setError] = useState(""),
        view = useNotebookView<RefundRecord>(cloud, "refunds", {}, expanded);
    return (
        <CollapsibleCard
            className="customer-refund-history"
            defaultOpen={false}
            onOpenChange={setExpanded}
            title="Customer refund history"
            description={`${cloud.counts?.refundRecords || 0} records · All dates and channels`}
        >
            {expanded && (
                <div className="supplier-statement-body">
                    <p className="import-note">
                        Refunds already issued outside this notebook. This history covers all dates
                        and channels.
                    </p>
                    {view.pending ? (
                        <ViewLoading
                            error={view.error}
                            retry={view.retry}
                        />
                    ) : (
                        <>
                            <p>
                                {view.total} refunds · ₱{(view.totals.amount || 0).toFixed(2)}{" "}
                                recorded
                            </p>
                            {view.total === 0 ? (
                                <p className="refund-history-empty">
                                    No customer refunds recorded yet. Refunds you record from an
                                    order’s details will appear here.
                                </p>
                            ) : (
                                <>
                                    <div className="table-scroll">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Date</th>
                                                    <th>Order line</th>
                                                    <th>Amount</th>
                                                    <th>Reason</th>
                                                    <th>Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {view.items.map((row) => (
                                                    <tr key={row.id}>
                                                        <td>{row.date}</td>
                                                        <td>{row.orderId}</td>
                                                        <td>₱{row.amount.toFixed(2)}</td>
                                                        <td>{row.reason}</td>
                                                        <td>
                                                            <button
                                                                className="text-button"
                                                                onClick={() => onOpen(row.orderId)}
                                                            >
                                                                Open order
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <Pagination
                                        label="Customer refund history"
                                        {...view.paging}
                                    />
                                </>
                            )}
                            <button
                                className="button secondary"
                                disabled={!view.total}
                                onClick={async () => {
                                    try {
                                        await downloadView(cloud, "refunds");
                                    } catch (e) {
                                        setError(
                                            e instanceof Error ? e.message : "Download failed.",
                                        );
                                    }
                                }}
                            >
                                Export customer refunds
                            </button>
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
        </CollapsibleCard>
    );
}
