"use client";
import { useState } from "react";
import { EntryModal } from "./entry-modal";
import { PurchasePayments } from "./purchase-payments";
import { SupplierRefunds } from "./supplier-refunds";
import { eligibleFinancialPurchases, purchasePaymentSummary } from "../lib/purchase-payments.mjs";
import type { PurchaseOrder, PurchasePayment } from "../lib/notebook-types";
type RecordEntry = (
    id: string,
    input: Omit<PurchasePayment, "id">,
    expected: string,
) => boolean | Promise<boolean>;
export function QuickFinancialEntry({
    kind,
    orders,
    onRecordPayment,
    onRecordRefund,
    disabled,
    onClose,
}: {
    kind: "payment" | "supplier-refund";
    orders: PurchaseOrder[];
    onRecordPayment: RecordEntry;
    onRecordRefund: RecordEntry;
    disabled: boolean;
    onClose: () => void;
}) {
    const [selectedId, setSelectedId] = useState("");
    const eligible = eligibleFinancialPurchases(orders, kind),
        selected = eligible.find((order) => order.id === selectedId);
    const money = (n: number) =>
        new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(n);
    return (
        <EntryModal
            title={kind === "payment" ? "Record purchase payment" : "Record supplier refund"}
            description="Choose the purchase this record belongs to."
            onClose={onClose}
        >
            <div className="quick-financial-body">
                <label className="field">
                    <span>Purchase order</span>
                    <select
                        aria-label="Purchase for financial entry"
                        value={selected?.id || ""}
                        disabled={disabled}
                        onChange={(event) => setSelectedId(event.target.value)}
                    >
                        <option value="">Choose purchase order</option>
                        {eligible.map((order) => (
                            <option
                                key={order.id}
                                value={order.id}
                            >
                                {order.reference} · {order.supplierName} ·{" "}
                                {money(
                                    kind === "payment"
                                        ? purchasePaymentSummary(order).recordable
                                        : purchasePaymentSummary(order).credit,
                                )}
                            </option>
                        ))}
                    </select>
                </label>
                {!eligible.length && (
                    <p className="import-note">
                        {kind === "payment"
                            ? "No purchases have an item balance available for payment records."
                            : "No cancelled purchases have supplier credit available to refund."}
                    </p>
                )}
                {selected &&
                    (kind === "payment" ? (
                        <PurchasePayments
                            key={selected.id}
                            order={selected}
                            entryOnly
                            disabled={disabled}
                            onRecord={onRecordPayment}
                            onRemove={() => {}}
                            onRecordRefund={onRecordRefund}
                            onRemoveRefund={() => {}}
                            onComplete={onClose}
                            onClose={onClose}
                        />
                    ) : (
                        <SupplierRefunds
                            key={selected.id}
                            order={selected}
                            entryOnly
                            disabled={disabled}
                            onRecord={onRecordRefund}
                            onRemove={() => {}}
                            onComplete={onClose}
                            onClose={onClose}
                        />
                    ))}
            </div>
        </EntryModal>
    );
}
