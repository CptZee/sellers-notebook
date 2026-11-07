"use client";
import { useNotebookView, type CloudNotebook } from "../lib/use-notebook-view";
import { usePagination } from "../lib/use-pagination";
import { Pagination } from "./pagination";
import { ViewLoading } from "./view-loading";
import { downloadView } from "../lib/view-download";
import { confirmAction } from "./confirm-dialog";
import { useState } from "react";
import type { PurchaseOrder, PurchasePayment } from "../lib/notebook-types";
import { cancelRefundAvailable } from "../lib/supplier-returns.mjs";
import {
    paymentMethods,
    purchasePaymentSummary,
    purchasePaymentProgress,
} from "../lib/purchase-payments.mjs";
const money = (n: number) =>
    new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(n);
export function SupplierRefunds({
    order,
    disabled,
    onRecord,
    onRemove,
    entryOnly = false,
    onComplete,
    onClose,
    cloud,
    prepareEntry,
}: {
    cloud?: CloudNotebook;
    prepareEntry?: (id?: string) => Promise<PurchaseOrder | null>;
    order: PurchaseOrder;
    disabled: boolean;
    onRecord: (
        id: string,
        input: Omit<PurchasePayment, "id">,
        expected: string,
    ) => boolean | Promise<boolean>;
    onRemove: (id: string, recordId: string, expected: string) => void | Promise<void>;
    entryOnly?: boolean;
    onComplete?: () => void;
    onClose?: () => void;
}) {
    const [entryId, setEntryId] = useState(() => crypto.randomUUID());
    const [expanded, setExpanded] = useState(entryOnly),
        [adding, setAdding] = useState(entryOnly),
        [checkpoint, setCheckpoint] = useState(entryOnly ? purchasePaymentProgress(order) : "");
    const [historyError, setHistoryError] = useState(""),
        view = useNotebookView<PurchasePayment>(
            cloud,
            "supplier-refunds",
            { parent: order.id },
            expanded && !entryOnly,
        ),
        localPaging = usePagination(order.supplierRefunds || []),
        paging = cloud ? { ...view.paging, items: view.items } : localPaging;
    async function prepare() {
        try {
            return (await prepareEntry?.(order.id)) || order;
        } catch (e) {
            setHistoryError(e instanceof Error ? e.message : "Could not open this purchase.");
            return null;
        }
    }
    const rawSummary =
            (
                order as PurchaseOrder & {
                    financial?: ReturnType<typeof purchasePaymentSummary> & {
                        cancellationCredit?: number;
                    };
                }
            ).financial || purchasePaymentSummary(order),
        summary = {
            ...rawSummary,
            credit:
                (rawSummary as { cancellationCredit?: number }).cancellationCredit ??
                (order.goodsReturns ? cancelRefundAvailable(order) : rawSummary.credit),
        },
        progress = purchasePaymentProgress(order),
        today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }),
        earliest = (order.payments || []).map((p) => p.date).sort()[0];
    const entryForm = adding && (
        <form
            className="purchase-payment-form supplier-refund-form"
            onSubmit={async (event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget),
                    input = {
                        id: entryId,
                        amount: Number(data.get("amount")),
                        date: String(data.get("date")),
                        method: String(data.get("method")),
                        reference: String(data.get("reference") || ""),
                        notes: String(data.get("notes") || ""),
                    };
                if (
                    (await confirmAction(
                        `Record ${money(input.amount)} received from the supplier on ${input.date}? Confirm the refund has already arrived.`,
                    )) &&
                    (await onRecord(order.id, input, checkpoint))
                ) {
                    setAdding(false);
                    onComplete?.();
                }
            }}
        >
            <fieldset disabled={disabled}>
                <div className="supplier-fields">
                    <label className="field">
                        <span>Supplier refund amount (₱)</span>
                        <input
                            name="amount"
                            aria-label="Supplier refund amount"
                            type="number"
                            min="0.01"
                            max={summary.credit}
                            step="0.01"
                            required
                        />
                    </label>
                    <label className="field">
                        <span>Refund received date</span>
                        <input
                            name="date"
                            aria-label="Supplier refund date"
                            type="date"
                            min={earliest}
                            max={today}
                            defaultValue={today}
                            required
                        />
                    </label>
                    <label className="field">
                        <span>Refund method</span>
                        <select
                            name="method"
                            aria-label="Supplier refund method"
                        >
                            {paymentMethods.map((method) => (
                                <option key={method}>{method}</option>
                            ))}
                        </select>
                    </label>
                    <label className="field">
                        <span>Refund reference (optional)</span>
                        <input
                            name="reference"
                            aria-label="Supplier refund reference"
                            maxLength={100}
                        />
                    </label>
                    <label className="field supplier-notes">
                        <span>Private supplier refund notes</span>
                        <textarea
                            name="notes"
                            aria-label="Supplier refund notes"
                            rows={2}
                            maxLength={500}
                        />
                    </label>
                </div>
                {checkpoint !== progress && (
                    <p
                        className="auth-error"
                        role="alert"
                    >
                        This purchase changed on another device. Close and reopen refund entry to
                        review the latest credit.
                    </p>
                )}
                <div className="supplier-actions">
                    <button
                        className="button secondary"
                        type="button"
                        onClick={async () => {
                            setAdding(false);
                            onClose?.();
                        }}
                    >
                        Close supplier refund entry
                    </button>
                    <button
                        className="button primary"
                        disabled={checkpoint !== progress || summary.credit <= 0}
                    >
                        Save supplier refund
                    </button>
                </div>
            </fieldset>
        </form>
    );
    if (entryOnly)
        return (
            <div className="financial-entry">
                <p className="import-note">
                    Record money already returned by the supplier. Credit to review:{" "}
                    {money(summary.credit)}. Stock and overhead expenses remain unchanged.
                </p>
                {entryForm}
            </div>
        );
    return (
        <details
            className="supplier-refunds"
            onToggle={(e) => setExpanded(e.currentTarget.open)}
        >
            <summary>Supplier refunds received · {money(summary.refunded)} recorded</summary>
            {expanded && (
                <div>
                    <p className="import-note">
                        Record money already returned by the supplier against this cancelled
                        purchase’s item credit. These private records reduce credit to review, while
                        keeping the original payment history. Stock and overhead expenses stay
                        unchanged.
                    </p>
                    {historyError && (
                        <p
                            className="auth-error"
                            role="alert"
                        >
                            {historyError}
                        </p>
                    )}
                    {cloud && view.pending && (
                        <ViewLoading
                            error={view.error}
                            retry={view.retry}
                        />
                    )}
                    <Pagination
                        label="Supplier refunds"
                        {...paging}
                    />
                    {cloud && (
                        <button
                            className="text-button"
                            disabled={view.pending || !view.total}
                            onClick={async () => {
                                try {
                                    await downloadView(cloud, "supplier-refunds", {
                                        parent: order.id,
                                    });
                                } catch (e) {
                                    setHistoryError(
                                        e instanceof Error ? e.message : "Download failed.",
                                    );
                                }
                            }}
                        >
                            Export supplier refunds
                        </button>
                    )}
                    {paging.items.map((record) => (
                        <div
                            className="purchase-payment-record"
                            key={record.id}
                        >
                            <div>
                                <strong>{money(record.amount)}</strong> · {record.date} ·{" "}
                                {record.method}
                                {record.reference && <small>Reference: {record.reference}</small>}
                                {record.notes && <small>{record.notes}</small>}
                            </div>
                            <button
                                className="text-button cancel"
                                disabled={disabled || adding}
                                aria-label={`Remove supplier refund ${record.id}`}
                                onClick={async () => {
                                    const current = await prepare();
                                    if (!current) return;
                                    const latest = (current.supplierRefunds || []).find(
                                        (item) => item.id === record.id,
                                    );
                                    if (
                                        !latest ||
                                        [
                                            latest.amount,
                                            latest.date,
                                            latest.method,
                                            latest.reference,
                                            latest.notes,
                                        ].some(
                                            (value, index) =>
                                                value !==
                                                [
                                                    record.amount,
                                                    record.date,
                                                    record.method,
                                                    record.reference,
                                                    record.notes,
                                                ][index],
                                        )
                                    ) {
                                        setHistoryError(
                                            "This record changed. Review the latest history before removing it.",
                                        );
                                        return;
                                    }
                                    if (
                                        await confirmAction(
                                            `Remove this ${money(record.amount)} supplier refund record? This corrects notebook records only and does not reverse money received.`,
                                        )
                                    )
                                        await onRemove(
                                            order.id,
                                            record.id,
                                            purchasePaymentProgress(current),
                                        );
                                }}
                            >
                                Remove refund record
                            </button>
                        </div>
                    ))}
                    {!(cloud ? view.total : order.supplierRefunds?.length) && !view.pending && (
                        <p className="import-note">No supplier refunds recorded.</p>
                    )}
                    {!adding && (
                        <button
                            className="button secondary"
                            disabled={
                                disabled ||
                                summary.credit <= 0 ||
                                (order.supplierRefunds?.length || 0) >= 100
                            }
                            onClick={async () => {
                                const current = await prepare();
                                if (!current) return;
                                setEntryId(crypto.randomUUID());
                                setAdding(true);
                                setCheckpoint(purchasePaymentProgress(current));
                            }}
                        >
                            Record supplier refund
                        </button>
                    )}
                    {entryForm}
                </div>
            )}
        </details>
    );
}
