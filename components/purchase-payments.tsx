"use client";
import { useNotebookView, type CloudNotebook } from "../lib/use-notebook-view";
import { usePagination } from "../lib/use-pagination";
import { Pagination } from "./pagination";
import { ViewLoading } from "./view-loading";
import { downloadView } from "../lib/view-download";
import { confirmAction } from "./confirm-dialog";
import { useState } from "react";
import { SupplierRefunds } from "./supplier-refunds";
import type { PurchaseOrder, PurchasePayment } from "../lib/notebook-types";
import {
    paymentMethods,
    purchasePaymentSummary,
    purchasePaymentProgress,
} from "../lib/purchase-payments.mjs";
const money = (n: number) =>
    new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(n);
export function PurchasePayments({
    order,
    disabled,
    onRecord,
    onRemove,
    onRecordRefund,
    onRemoveRefund,
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
        payment: Omit<PurchasePayment, "id">,
        expected: string,
    ) => boolean | Promise<boolean>;
    onRemove: (id: string, paymentId: string, expected: string) => void | Promise<void>;
    onRecordRefund: (
        id: string,
        input: Omit<PurchasePayment, "id">,
        expected: string,
    ) => boolean | Promise<boolean>;
    onRemoveRefund: (id: string, recordId: string, expected: string) => void | Promise<void>;
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
            "payments",
            { parent: order.id },
            expanded && !entryOnly,
        ),
        localPaging = usePagination(order.payments || []),
        paging = cloud ? { ...view.paging, items: view.items } : localPaging;
    async function prepare() {
        try {
            return (await prepareEntry?.(order.id)) || order;
        } catch (e) {
            setHistoryError(e instanceof Error ? e.message : "Could not open this purchase.");
            return null;
        }
    }
    const summary =
            (order as PurchaseOrder & { financial?: ReturnType<typeof purchasePaymentSummary> })
                .financial || purchasePaymentSummary(order),
        progress = purchasePaymentProgress(order),
        today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    const entryForm = adding && (
        <form
            className="purchase-payment-form"
            onSubmit={async (event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget),
                    payment = {
                        id: entryId,
                        amount: Number(form.get("amount")),
                        date: String(form.get("date")),
                        method: String(form.get("method")),
                        reference: String(form.get("reference") || ""),
                        notes: String(form.get("notes") || ""),
                    };
                if (
                    !(await confirmAction(
                        `Record ${money(payment.amount)} as paid on ${payment.date}? This is a notebook entry for a payment already made.`,
                    ))
                )
                    return;
                if (await onRecord(order.id, payment, checkpoint)) {
                    setAdding(false);
                    onComplete?.();
                }
            }}
        >
            <fieldset disabled={disabled}>
                <div className="supplier-fields">
                    <label className="field">
                        <span>Payment amount (₱)</span>
                        <input
                            aria-label="Purchase payment amount"
                            name="amount"
                            type="number"
                            min="0.01"
                            max={summary.recordable}
                            step="0.01"
                            required
                        />
                    </label>
                    <label className="field">
                        <span>Payment date</span>
                        <input
                            aria-label="Purchase payment date"
                            name="date"
                            type="date"
                            required
                            max={today}
                            defaultValue={today}
                        />
                    </label>
                    <label className="field">
                        <span>Payment method</span>
                        <select
                            aria-label="Purchase payment method"
                            name="method"
                        >
                            {paymentMethods.map((method) => (
                                <option key={method}>{method}</option>
                            ))}
                        </select>
                    </label>
                    <label className="field">
                        <span>Payment reference (optional)</span>
                        <input
                            aria-label="Purchase payment reference"
                            name="reference"
                            maxLength={100}
                        />
                    </label>
                    <label className="field supplier-notes">
                        <span>Private payment notes</span>
                        <textarea
                            aria-label="Purchase payment notes"
                            name="notes"
                            maxLength={500}
                            rows={2}
                        />
                    </label>
                </div>
                {checkpoint !== progress && (
                    <p
                        className="auth-error"
                        role="alert"
                    >
                        This purchase changed on another device. Close and reopen payment entry to
                        review the latest balance.
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
                        Close payment entry
                    </button>
                    <button
                        className="button primary"
                        disabled={checkpoint !== progress || order.status === "Cancelled"}
                    >
                        Save payment record
                    </button>
                </div>
            </fieldset>
        </form>
    );
    if (entryOnly)
        return (
            <div className="financial-entry">
                <p className="import-note">
                    Record an item-cost payment already made outside this app. Current unrecorded
                    item balance: {money(summary.balance)}. Tax and delivery are excluded.
                </p>
                {entryForm}
            </div>
        );
    return (
        <details
            className="purchase-payments"
            onToggle={(e) => setExpanded(e.currentTarget.open)}
        >
            <summary>
                Payment records · {money(summary.paid)} recorded
                {summary.credit ? ` · ${money(summary.credit)} credit to review` : ""}
            </summary>
            {expanded && (
                <div>
                    <p className="import-note">
                        Record payments already made outside this app toward item costs only. Tax
                        and delivery are excluded. These private records do not make payments,
                        change stock, or add overhead expenses. Supplier copies omit payment
                        details.
                    </p>
                    <dl className="purchase-payment-summary">
                        <div>
                            <dt>Item amount to reconcile</dt>
                            <dd>{money(summary.itemTotal)}</dd>
                        </div>
                        <div>
                            <dt>Recorded payments</dt>
                            <dd>{money(summary.paid)}</dd>
                        </div>
                        {summary.refunded > 0 && (
                            <>
                                <div>
                                    <dt>Supplier refunds received</dt>
                                    <dd>{money(summary.refunded)}</dd>
                                </div>
                                <div>
                                    <dt>Net paid after refunds</dt>
                                    <dd>{money(summary.netPaid)}</dd>
                                </div>
                            </>
                        )}
                        <div>
                            <dt>Unrecorded item balance</dt>
                            <dd>{money(summary.balance)}</dd>
                        </div>
                        {summary.credit > 0 && (
                            <div>
                                <dt>Credit to review with supplier</dt>
                                <dd>{money(summary.credit)}</dd>
                            </div>
                        )}
                    </dl>
                    {order.status === "Cancelled" && (
                        <p className="import-note">
                            For cancelled purchases, the item amount uses only units received.
                            Review any excess recorded payments with your supplier. Record money
                            returned in Supplier refunds received below.
                        </p>
                    )}
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
                        label="Purchase payments"
                        {...paging}
                    />
                    {cloud && (
                        <button
                            className="text-button"
                            disabled={view.pending || !view.total}
                            onClick={async () => {
                                try {
                                    await downloadView(cloud, "payments", { parent: order.id });
                                } catch (e) {
                                    setHistoryError(
                                        e instanceof Error ? e.message : "Download failed.",
                                    );
                                }
                            }}
                        >
                            Export purchase payments
                        </button>
                    )}{" "}
                    {paging.items.map((payment) => (
                        <div
                            className="purchase-payment-record"
                            key={payment.id}
                        >
                            <div>
                                <strong>{money(payment.amount)}</strong> · {payment.date} ·{" "}
                                {payment.method}
                                {payment.reference && <small>Reference: {payment.reference}</small>}
                                {payment.notes && <small>{payment.notes}</small>}
                            </div>
                            <button
                                className="text-button cancel"
                                disabled={disabled || adding}
                                aria-label={`Remove payment ${payment.id}`}
                                onClick={async () => {
                                    const current = await prepare();
                                    if (!current) return;
                                    const latest = (current.payments || []).find(
                                        (item) => item.id === payment.id,
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
                                                    payment.amount,
                                                    payment.date,
                                                    payment.method,
                                                    payment.reference,
                                                    payment.notes,
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
                                            `Remove this ${money(payment.amount)} payment record? This changes notebook records only and does not reverse a real payment.`,
                                        )
                                    )
                                        await onRemove(
                                            order.id,
                                            payment.id,
                                            purchasePaymentProgress(current),
                                        );
                                }}
                            >
                                Remove record
                            </button>
                        </div>
                    ))}
                    {!(cloud ? view.total : order.payments?.length) && !view.pending && (
                        <p className="import-note">No payment records yet.</p>
                    )}
                    {!adding && (
                        <button
                            className="button secondary"
                            disabled={
                                disabled ||
                                order.status === "Cancelled" ||
                                summary.recordable <= 0 ||
                                (order.payments?.length || 0) >= 100
                            }
                            onClick={async () => {
                                const current = await prepare();
                                if (!current) return;
                                setEntryId(crypto.randomUUID());
                                setAdding(true);
                                setCheckpoint(purchasePaymentProgress(current));
                            }}
                        >
                            Record a payment
                        </button>
                    )}
                    {entryForm}
                    {order.status === "Cancelled" && (
                        <SupplierRefunds
                            cloud={cloud}
                            prepareEntry={prepareEntry}
                            order={order}
                            disabled={disabled}
                            onRecord={onRecordRefund}
                            onRemove={onRemoveRefund}
                        />
                    )}
                </div>
            )}
        </details>
    );
}
