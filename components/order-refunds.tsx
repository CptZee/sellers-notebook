"use client";
import { useNotebookView, type CloudNotebook } from "../lib/use-notebook-view";
import { usePagination } from "../lib/use-pagination";
import { Pagination } from "./pagination";
import { ViewLoading } from "./view-loading";
import { downloadView } from "../lib/view-download";
import { confirmAction } from "./confirm-dialog";
import { useState } from "react";
import type { Order, RefundRecord } from "../lib/notebook-types";
import { refundTotal } from "../lib/refunds.mjs";
export function OrderRefunds({
    lines,
    records,
    onRecord,
    onRemove,
    disabled,
    cloud,
}: {
    cloud?: CloudNotebook;
    lines: Order[];
    records: RefundRecord[];
    onRecord: (input: {
        id?: string;
        orderId: string;
        amount: number;
        date: string;
        reason: string;
    }) => void | Promise<void>;
    onRemove: (id: string, record?: RefundRecord) => void | Promise<void>;
    disabled: boolean;
}) {
    const [orderId, setOrderId] = useState(""),
        [amount, setAmount] = useState(""),
        [reason, setReason] = useState(""),
        [error, setError] = useState(""),
        [draftId, setDraftId] = useState(() => crypto.randomUUID()),
        [submitting, setSubmitting] = useState(false);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date()),
        [date, setDate] = useState(today);
    const own = records.filter((record) => lines.some((line) => line.id === record.orderId)),
        order = lines.find((line) => line.id === orderId);
    const [expanded, setExpanded] = useState(false),
        view = useNotebookView<RefundRecord>(
            cloud,
            "refunds",
            { parent: lines[0]?.id || "" },
            expanded,
        ),
        localPaging = usePagination(own),
        paging = cloud ? { ...view.paging, items: view.items } : localPaging;
    const remaining = order
        ? (Math.round(order.price * order.quantity * 100) -
              Math.round(refundTotal(own.filter((record) => record.orderId === order.id)) * 100)) /
          100
        : 0;
    return (
        <details
            className="order-private-details order-refunds"
            onToggle={(event) => setExpanded(event.currentTarget.open)}
        >
            <summary>Refund records · {own.length}</summary>
            <p>
                Record refunds already issued through your marketplace or payment provider. This
                only updates the notebook; it does not move money or change stock. Use Stock
                adjustments separately for returned goods. Fees and original product costs are
                retained.
            </p>
            {lines.some((line) => line.status === "Completed") && (
                <form
                    onSubmit={async (e) => {
                        e.preventDefault();
                        if (submitting) return;
                        setError("");
                        setSubmitting(true);
                        try {
                            if (!order) throw Error("Choose an order line from this summary.");
                            await onRecord({
                                id: draftId,
                                orderId,
                                amount: Number(amount),
                                date,
                                reason,
                            });
                            setDraftId(crypto.randomUUID());
                            setAmount("");
                            setReason("");
                        } catch (e) {
                            setError(
                                e instanceof Error ? e.message : "Could not record this refund.",
                            );
                        } finally {
                            setSubmitting(false);
                        }
                    }}
                >
                    <fieldset disabled={disabled || submitting}>
                        <label className="field">
                            <span>Refund order line</span>
                            <select
                                aria-label="Refund order line"
                                required
                                value={orderId}
                                onChange={(e) => {
                                    setOrderId(e.target.value);
                                    setError("");
                                }}
                            >
                                <option value="">Choose a completed line</option>
                                {lines
                                    .filter((line) => line.status === "Completed")
                                    .map((line) => (
                                        <option
                                            key={line.id}
                                            value={line.id}
                                        >
                                            {line.productName} · Qty {line.quantity}
                                        </option>
                                    ))}
                            </select>
                        </label>
                        <label className="field">
                            <span>Refund amount (PHP)</span>
                            <input
                                required
                                type="number"
                                step="0.01"
                                min="0.01"
                                max={remaining || undefined}
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                            />
                        </label>
                        <label className="field">
                            <span>Refund date</span>
                            <input
                                required
                                type="date"
                                min={order?.date}
                                max={today}
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                            />
                        </label>
                        <label className="field">
                            <span>Refund reason</span>
                            <input
                                required
                                maxLength={200}
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                            />
                        </label>
                        <small>
                            {order
                                ? `Remaining item value: ₱${remaining.toFixed(2)}`
                                : "Choose an order line to see the refundable amount."}
                        </small>
                        <button
                            className="button secondary"
                            type="submit"
                            disabled={!order || remaining <= 0}
                        >
                            Record issued refund
                        </button>
                    </fieldset>
                </form>
            )}
            {error && (
                <p
                    className="auth-error"
                    role="alert"
                >
                    {error}
                </p>
            )}
            {cloud && expanded && view.pending && (
                <ViewLoading
                    error={view.error}
                    retry={view.retry}
                />
            )}
            <Pagination
                label="Order refunds"
                {...paging}
            />
            {cloud && (
                <button
                    className="text-button"
                    disabled={view.pending || !view.total}
                    onClick={async () => {
                        try {
                            await downloadView(cloud, "refunds", { parent: lines[0].id });
                        } catch (e) {
                            setError(e instanceof Error ? e.message : "Download failed.");
                        }
                    }}
                >
                    Export order refunds
                </button>
            )}
            {paging.items.map((record) => (
                <div
                    className="refund-record"
                    key={record.id}
                >
                    <span>
                        {record.date} · ₱{record.amount.toFixed(2)}
                        <small>{record.reason}</small>
                    </span>
                    <button
                        className="text-button cancel"
                        type="button"
                        disabled={disabled}
                        onClick={async () => {
                            if (
                                await confirmAction(
                                    "Remove this notebook refund record? This does not reverse the actual payment.",
                                )
                            ) {
                                try {
                                    await onRemove(record.id, record);
                                } catch (e) {
                                    setError(
                                        e instanceof Error
                                            ? e.message
                                            : "Could not remove this refund.",
                                    );
                                }
                            }
                        }}
                    >
                        Remove record
                    </button>
                </div>
            ))}
        </details>
    );
}
