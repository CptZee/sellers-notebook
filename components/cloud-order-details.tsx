"use client";
import { useEffect, useState } from "react";
import type { CloudNotebook } from "../lib/use-notebook-view";
import type { Branding, Order, RefundRecord } from "../lib/notebook-types";
import { EntryModal } from "./entry-modal";
import { OrderDetails } from "./order-details";
export function CloudOrderDetails({
    cloud,
    id,
    branding,
    onSave,
    onClose,
    disabled,
}: {
    cloud: CloudNotebook;
    id: string;
    branding: Branding | null;
    onSave: (command: Record<string, unknown>) => Promise<void>;
    onClose: () => void;
    disabled: boolean;
}) {
    const [attempt, setAttempt] = useState(0),
        scope = cloud.userId + "|" + id,
        key = scope + "|" + cloud.revision,
        [state, setState] = useState<{
            key: string;
            scope?: string;
            data?: { orders: Order[]; refunds: RefundRecord[] };
            error?: string;
        }>({ key: "" });
    useEffect(() => {
        const controller = new AbortController();
        void fetch(
            "/api/notebook/order?" + new URLSearchParams({ id, revision: String(cloud.revision) }),
            {
                cache: "no-store",
                headers: { "X-Notebook-User": cloud.userId },
                signal: controller.signal,
            },
        )
            .then(async (response) => {
                const data = await response.json();
                if (!response.ok) throw Error(data.error || "Could not open this order.");
                if (!controller.signal.aborted) setState({ key, scope, data });
            })
            .catch((error) => {
                if (!controller.signal.aborted)
                    setState((previous) => ({
                        key,
                        scope,
                        data: previous.scope === scope ? previous.data : undefined,
                        error:
                            error instanceof Error ? error.message : "Could not open this order.",
                    }));
            });
        return () => controller.abort();
    }, [key, attempt]);
    const data = state.scope === scope ? state.data : undefined,
        pending = state.key !== key || !!state.error,
        notice = (
            <p
                className="import-note"
                role="status"
            >
                {(state.key === key && state.error) || "Updating this order…"}
                {state.key === key && state.error && (
                    <button
                        className="text-button"
                        onClick={() => setAttempt((n) => n + 1)}
                    >
                        Retry order
                    </button>
                )}
            </p>
        );
    if (!data)
        return (
            <EntryModal
                title="Order details"
                description="Opening the selected order"
                onClose={onClose}
            >
                {notice}
            </EntryModal>
        );
    return (
        <OrderDetails
            cloud={cloud}
            orders={data.orders}
            refunds={data.refunds}
            id={id}
            branding={branding}
            notice={pending ? notice : undefined}
            disabled={disabled || pending}
            onClose={onClose}
            onRecordRefund={async (input) => {
                const expected = data.orders.find((order) => order.id === input.orderId);
                if (!expected) throw Error("Order no longer exists.");
                await onSave({
                    kind: "refund",
                    id: input.id || crypto.randomUUID(),
                    input: {
                        orderId: input.orderId,
                        amount: input.amount,
                        date: input.date,
                        reason: input.reason,
                    },
                    expected,
                });
            }}
            onRemoveRefund={async (id, record) => {
                const expected = record || data.refunds.find((record) => record.id === id);
                if (!expected) throw Error("This refund was removed. Refresh the history.");
                await onSave({ kind: "remove-refund", id, expected });
            }}
        />
    );
}
