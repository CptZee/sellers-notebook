"use client";
import { useEffect, useState } from "react";
import type { CloudNotebook } from "../lib/use-notebook-view";
import { usePurchaseRecords } from "../lib/use-purchase-records";
import { purchaseProgress } from "../lib/purchases.mjs";
import { purchasePaymentProgress } from "../lib/purchase-payments.mjs";
import { purchaseScheduleVersion } from "../lib/delivery-reminders.mjs";
import type { Branding, PurchasePayment } from "../lib/notebook-types";
import type { QuickCreateRequest } from "./quick-create";
import { PurchaseOrders } from "./purchase-orders";
import { PurchaseEntry } from "./purchase-entry";
type Focus = { id: string; action: "view" | "receive"; sequence: number };
export function CloudPurchases({
    cloud,
    branding,
    onSave,
    quickRequest,
    focusRequest,
    editorOnly,
    disabled,
}: {
    cloud: CloudNotebook;
    branding: Branding | null;
    onSave: (command: Record<string, unknown>) => Promise<void>;
    quickRequest?: QuickCreateRequest | null;
    focusRequest?: Focus | null;
    editorOnly: boolean;
    disabled: boolean;
}) {
    const engine = usePurchaseRecords(cloud, onSave),
        [creating, setCreating] = useState(false),
        [focusReady, setFocusReady] = useState<Focus | null>(null);
    useEffect(() => {
        let active = true;
        if (focusRequest)
            void engine
                .prepare(focusRequest.id)
                .then(() => {
                    if (active) setFocusReady(focusRequest);
                })
                .catch((error) =>
                    engine.setError(
                        error instanceof Error ? error.message : "Could not open purchase.",
                    ),
                );
        return () => {
            active = false;
        };
    }, [focusRequest]);
    async function act(kind: string, id: string, input?: unknown, entryId?: string) {
        try {
            engine.setError("");
            await engine.command(kind, id, input, entryId);
            return true;
        } catch (error) {
            engine.setError(
                error instanceof Error ? error.message : "Could not save this purchase.",
            );
            return false;
        }
    }
    async function finance(
        kind: string,
        id: string,
        input: Omit<PurchasePayment, "id">,
        expected: string,
    ) {
        const order = engine.get(id);
        if (!order || purchasePaymentProgress(order) !== expected) {
            engine.setError("This purchase changed. Reopen the financial entry.");
            return false;
        }
        const { id: entryId, ...fields } = input as PurchasePayment;
        return act(kind, id, fields, entryId);
    }
    async function remove(kind: string, id: string, recordId: string, expected: string) {
        const order = engine.get(id);
        if (!order || purchasePaymentProgress(order) !== expected) {
            engine.setError("This purchase changed. Review its latest financial records.");
            return;
        }
        await act(kind, id, { recordId });
    }
    return (
        <>
            {engine.error && (
                <p
                    className="auth-error"
                    role="alert"
                >
                    {engine.error}
                    <button
                        className="text-button"
                        onClick={async () => {
                            engine.setError("");
                            try {
                                const ids = new Set(engine.orders.map((order) => order.id));
                                if (focusRequest) ids.add(focusRequest.id);
                                await Promise.all([...ids].map((id) => engine.prepare(id)));
                                if (focusRequest) setFocusReady(focusRequest);
                            } catch (error) {
                                engine.setError(
                                    error instanceof Error
                                        ? error.message
                                        : "Could not refresh purchases.",
                                );
                            }
                        }}
                    >
                        Retry purchase records
                    </button>
                </p>
            )}
            {creating && (
                <PurchaseEntry
                    cloud={cloud}
                    onSave={onSave}
                    onClose={() => setCreating(false)}
                    disabled={disabled}
                />
            )}
            <PurchaseOrders
                onGoodsCommand={async (kind, id, input, expected, entryId) => {
                    await onSave({ kind, id, input, expected, ...(entryId ? { entryId } : {}) });
                }}
                cloud={cloud}
                branding={branding}
                suppliers={[]}
                products={[]}
                orders={engine.orders}
                quickRequest={quickRequest}
                editorOnly={editorOnly}
                focusRequest={focusReady}
                prepareEntry={engine.prepare}
                onStartCreate={() => {
                    if ((cloud.counts?.purchaseOrders || 0) >= 3000) {
                        engine.setError("Purchase limit reached.");
                        return;
                    }
                    setCreating(true);
                }}
                disabled={disabled || engine.pending}
                onCreate={() => {}}
                onSchedule={async (id, date, expected) => {
                    const order = engine.get(id);
                    if (!order || purchaseScheduleVersion(order) !== expected) {
                        engine.setError("This purchase changed. Reopen the expected date.");
                        return false;
                    }
                    return act("schedule", id, { date });
                }}
                onReceive={async (id, delivery, expected) => {
                    const order = engine.get(id);
                    if (!order || (expected && purchaseProgress(order) !== expected)) {
                        engine.setError(
                            "This delivery changed. Review the latest received quantities.",
                        );
                        return false;
                    }
                    return act("receive", id, delivery ? { delivery } : {});
                }}
                onCancel={async (id) => {
                    await act("cancel", id);
                }}
                onRecordPayment={(id, input, expected) => finance("payment", id, input, expected)}
                onRecordSupplierRefund={(id, input, expected) =>
                    finance("refund", id, input, expected)
                }
                onRemovePayment={(id, recordId, expected) =>
                    remove("remove-payment", id, recordId, expected)
                }
                onRemoveSupplierRefund={(id, recordId, expected) =>
                    remove("remove-refund", id, recordId, expected)
                }
            />
        </>
    );
}
