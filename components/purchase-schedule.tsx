"use client";
import { useState } from "react";
import { EntryModal } from "./entry-modal";
import { purchaseScheduleVersion } from "../lib/delivery-reminders.mjs";
import type { PurchaseOrder } from "../lib/notebook-types";
export function PurchaseSchedule({
    order,
    onSave,
    disabled,
    prepareEntry,
}: {
    prepareEntry?: (id?: string) => Promise<PurchaseOrder | null>;
    order: PurchaseOrder;
    onSave: (id: string, date: string, expected: string) => boolean | Promise<boolean>;
    disabled: boolean;
}) {
    const [open, setOpen] = useState(false),
        [checkpoint, setCheckpoint] = useState(""),
        [error, setError] = useState("");
    if (!["Ordered", "Partially received"].includes(order.status)) return null;
    return (
        <>
            {error && (
                <p
                    className="auth-error"
                    role="alert"
                >
                    {error}
                </p>
            )}
            <button
                type="button"
                className="text-button purchase-schedule-button"
                disabled={disabled}
                onClick={async () => {
                    try {
                        const current = await prepareEntry?.(order.id);
                        setCheckpoint(purchaseScheduleVersion(current || order));
                        setOpen(true);
                    } catch (e) {
                        setError(
                            e instanceof Error ? e.message : "Could not open delivery schedule.",
                        );
                    }
                }}
            >
                {order.expectedDate ? "Change expected delivery" : "Set expected delivery"}
            </button>
            {open && (
                <EntryModal
                    title="Expected delivery"
                    description={order.reference + " · " + order.supplierName}
                    onClose={() => setOpen(false)}
                >
                    <form
                        onSubmit={async (event) => {
                            event.preventDefault();
                            const date = String(
                                new FormData(event.currentTarget).get("date") || "",
                            );
                            if (await onSave(order.id, date, checkpoint)) setOpen(false);
                        }}
                    >
                        <label className="field">
                            <span>Expected delivery date</span>
                            <input
                                name="date"
                                aria-label="Expected delivery date"
                                type="date"
                                defaultValue={order.expectedDate}
                            />
                            <small>
                                Leave blank if the supplier has not given a date. This changes the
                                reminder schedule only.
                            </small>
                        </label>
                        {checkpoint !== purchaseScheduleVersion(order) && (
                            <p
                                className="auth-error"
                                role="alert"
                            >
                                This purchase changed on another device. Close and reopen the date
                                to review the latest details.
                            </p>
                        )}
                        <div className="supplier-actions">
                            <button
                                type="button"
                                className="button secondary"
                                onClick={() => setOpen(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="button primary"
                                disabled={disabled || checkpoint !== purchaseScheduleVersion(order)}
                            >
                                Save expected delivery
                            </button>
                        </div>
                    </form>
                </EntryModal>
            )}
        </>
    );
}
