"use client";
import { useState } from "react";
import { useNotebookView, type CloudNotebook } from "../lib/use-notebook-view";
import { usePurchaseRecords } from "../lib/use-purchase-records";
import { purchasePaymentProgress } from "../lib/purchase-payments.mjs";
import type { StatementRow } from "../lib/supplier-statements.mjs";
import type { PurchasePayment } from "../lib/notebook-types";
import { EntryModal } from "./entry-modal";
import { Pagination } from "./pagination";
import { PurchasePayments } from "./purchase-payments";
import { SupplierRefunds } from "./supplier-refunds";
export function CloudFinancialEntry({
    cloud,
    kind,
    onSave,
    onClose,
    disabled,
}: {
    cloud: CloudNotebook;
    kind: "payment" | "supplier-refund";
    onSave: (command: Record<string, unknown>) => Promise<void>;
    onClose: () => void;
    disabled: boolean;
}) {
    const [search, setSearch] = useState(""),
        [selectedId, setSelectedId] = useState(""),
        engine = usePurchaseRecords(cloud, onSave),
        view = useNotebookView<StatementRow>(cloud, "statements", { financial: kind, search }),
        selected = engine.orders.find((order) => order.id === selectedId);
    async function record(id: string, input: Omit<PurchasePayment, "id">, expected: string) {
        const current = engine.get(id);
        if (!current || purchasePaymentProgress(current) !== expected) {
            engine.setError("This purchase changed. Reopen the financial entry.");
            return false;
        }
        try {
            engine.setError("");
            const { id: entryId, ...fields } = input as PurchasePayment;
            await engine.command(kind === "payment" ? "payment" : "refund", id, fields, entryId);
            return true;
        } catch (error) {
            engine.setError(
                error instanceof Error ? error.message : "Could not save the financial record.",
            );
            return false;
        }
    }
    return (
        <EntryModal
            title={kind === "payment" ? "Record purchase payment" : "Record supplier refund"}
            description="Choose the purchase this record belongs to."
            onClose={onClose}
        >
            <div className="quick-financial-body">
                <label className="field">
                    <span>Find a purchase</span>
                    <input
                        aria-label="Find a financial purchase"
                        maxLength={200}
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                </label>
                <label className="field">
                    <span>Purchase order</span>
                    <select
                        aria-label="Purchase for financial entry"
                        value={selectedId}
                        disabled={disabled || engine.pending}
                        onChange={async (event) => {
                            const id = event.target.value;
                            setSelectedId(id);
                            if (id)
                                try {
                                    await engine.prepare(id);
                                } catch (error) {
                                    engine.setError(
                                        error instanceof Error
                                            ? error.message
                                            : "Could not open purchase.",
                                    );
                                }
                        }}
                    >
                        <option value="">Choose purchase order</option>
                        {selected && !view.items.some((row) => row.id === selected.id) && (
                            <option value={selected.id}>
                                {selected.reference} · {selected.supplierName} (selected)
                            </option>
                        )}
                        {view.items.map((row) => (
                            <option
                                key={row.id}
                                value={row.id}
                            >
                                {row.reference} · {row.supplierName} · ₱
                                {(kind === "payment" ? row.recordable : row.credit).toFixed(2)}
                            </option>
                        ))}
                    </select>
                </label>
                {view.pending ? (
                    <p
                        role="status"
                        className="import-note"
                    >
                        {view.error || "Finding eligible purchases…"}
                        {view.error && (
                            <button
                                className="text-button"
                                onClick={view.retry}
                            >
                                Retry financial purchases
                            </button>
                        )}
                    </p>
                ) : (
                    <>
                        <Pagination
                            label="Financial purchases"
                            {...view.paging}
                        />
                        {!view.total && (
                            <p className="import-note">
                                {kind === "payment"
                                    ? "No matching purchases have an item balance available for payment records."
                                    : "No matching cancelled purchases have supplier credit available to refund."}
                            </p>
                        )}
                    </>
                )}
                {engine.pending && selectedId && !selected && (
                    <p
                        className="import-note"
                        role="status"
                    >
                        Opening selected purchase…
                    </p>
                )}
                {engine.error && (
                    <p
                        className="auth-error"
                        role="alert"
                    >
                        {engine.error}
                        {selectedId && (
                            <button
                                className="text-button"
                                onClick={async () => {
                                    engine.setError("");
                                    try {
                                        await engine.prepare(selectedId);
                                    } catch (error) {
                                        engine.setError(
                                            error instanceof Error
                                                ? error.message
                                                : "Could not open purchase.",
                                        );
                                    }
                                }}
                            >
                                Retry selected purchase
                            </button>
                        )}
                    </p>
                )}
                {selected &&
                    (kind === "payment" ? (
                        <PurchasePayments
                            key={selected.id}
                            order={selected}
                            entryOnly
                            disabled={disabled || engine.pending}
                            onRecord={record}
                            onRemove={() => {}}
                            onRecordRefund={record}
                            onRemoveRefund={() => {}}
                            onComplete={onClose}
                            onClose={onClose}
                        />
                    ) : (
                        <SupplierRefunds
                            key={selected.id}
                            order={selected}
                            entryOnly
                            disabled={disabled || engine.pending}
                            onRecord={record}
                            onRemove={() => {}}
                            onComplete={onClose}
                            onClose={onClose}
                        />
                    ))}
            </div>
        </EntryModal>
    );
}
