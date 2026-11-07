"use client";
import { useEffect, useRef, useState } from "react";
import { EntryModal } from "./entry-modal";
type Request = { message: string; resolve: (confirmed: boolean) => void; key: string };
let requestConfirmation: ((message: string, resolve: (confirmed: boolean) => void) => void) | null =
    null;
export function confirmAction(message: string): Promise<boolean> {
    return new Promise((resolve) => {
        if (requestConfirmation) requestConfirmation(message, resolve);
        else resolve(false);
    });
}
export function ConfirmDialog({ stateKey }: { stateKey: string }) {
    const [queue, setQueue] = useState<Request[]>([]),
        key = useRef(stateKey),
        pending = useRef<Request[]>([]);
    key.current = stateKey;
    useEffect(() => {
        requestConfirmation = (message, resolve) => {
            const request = { message, resolve, key: key.current };
            pending.current = [...pending.current, request];
            setQueue(pending.current);
        };
        return () => {
            requestConfirmation = null;
            pending.current.forEach((request) => request.resolve(false));
            pending.current = [];
        };
    }, []);
    const current = queue[0];
    function finish(answer: boolean) {
        if (!current) return;
        pending.current = pending.current.filter((item) => item !== current);
        setQueue(pending.current);
        current.resolve(answer && current.key === key.current);
    }
    if (!current) return null;
    const stale = current.key !== stateKey;
    return (
        <EntryModal
            className="confirmation-modal"
            title="Please confirm"
            description="Review this change before continuing."
            onClose={() => finish(false)}
        >
            <div className="confirmation-body">
                <p>{current.message}</p>
                {stale && (
                    <p
                        className="auth-error"
                        role="alert"
                    >
                        The notebook changed while this dialog was open. Cancel and review the
                        latest details before trying again.
                    </p>
                )}
            </div>
            <div className="modal-actions">
                <button
                    className="button secondary"
                    onClick={() => finish(false)}
                >
                    Cancel
                </button>
                <button
                    className="button primary"
                    disabled={stale}
                    onClick={() => finish(true)}
                >
                    Continue
                </button>
            </div>
        </EntryModal>
    );
}
