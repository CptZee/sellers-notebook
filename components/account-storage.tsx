"use client";
import { useCallback, useEffect, useState } from "react";
import { HardDrive, RefreshCw } from "lucide-react";
import { formatStorage, type StorageUsage } from "../lib/storage-usage.mjs";
import "./account-storage.css";

export function AccountStorage({ userId, compact = false }: { userId: string; compact?: boolean }) {
    const [state, setState] = useState<{ owner: string; data?: StorageUsage; error?: string }>({
        owner: userId,
    });
    const [busy, setBusy] = useState(false),
        [attempt, setAttempt] = useState(0);
    const refresh = useCallback(() => setAttempt((value) => value + 1), []);
    useEffect(() => {
        const controller = new AbortController();
        void fetch("/api/account/storage", {
            cache: "no-store",
            headers: { "X-Notebook-User": userId },
            signal: controller.signal,
        })
            .then(async (response) => {
                const data = await response.json();
                if (!response.ok) throw Error(data.error || "Could not check storage.");
                if (!controller.signal.aborted) setState({ owner: userId, data });
            })
            .catch((error) => {
                if (!controller.signal.aborted) setState({ owner: userId, error: error.message });
            });
        window.addEventListener("notebook-storage-changed", refresh);
        window.addEventListener("focus", refresh);
        return () => {
            controller.abort();
            window.removeEventListener("notebook-storage-changed", refresh);
            window.removeEventListener("focus", refresh);
        };
    }, [userId, attempt, refresh]);
    const usage = state.owner === userId ? state.data : undefined;
    async function recover() {
        setBusy(true);
        try {
            const response = await fetch("/api/account/storage", {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Notebook-User": userId },
                body: JSON.stringify({ action: "recover" }),
            });
            const data = await response.json();
            if (!response.ok) throw Error(data.error || "Could not recover storage.");
            window.dispatchEvent(new Event("notebook-storage-changed"));
        } catch (error) {
            setState((previous) => ({
                ...previous,
                error: error instanceof Error ? error.message : "Please retry.",
            }));
        } finally {
            setBusy(false);
        }
    }
    return (
        <section
            className={`account-storage${compact ? " compact" : ""}`}
            aria-label="Account file storage"
        >
            <div className="storage-heading">
                <HardDrive size={18} />
                <h3>{compact ? "Your file storage" : "Your account’s file storage"}</h3>
                <button
                    type="button"
                    className="icon-button"
                    aria-label="Refresh storage usage"
                    onClick={refresh}
                    disabled={busy}
                >
                    <RefreshCw size={15} />
                </button>
            </div>
            {usage ? (
                <>
                    <div className="storage-totals">
                        <strong>Free notebook</strong>
                        <span>{formatStorage(usage.usedBytes)} used</span>
                    </div>
                    <p className="storage-explainer">
                        No account storage quota. Individual attachments can be up to 5 MB and
                        profile pictures up to 1 MB. Business records have separate validation
                        limits.
                    </p>
                    {usage.pendingBytes > 0 && (
                        <div className="storage-pending">
                            <p>
                                {formatStorage(usage.pendingBytes)} in unfinished uploads. Clear
                                unfinished uploads older than 10 minutes if an upload was
                                interrupted.
                            </p>
                            <button
                                type="button"
                                className="text-button"
                                disabled={busy}
                                onClick={() => void recover()}
                            >
                                {busy ? "Checking…" : "Clear unfinished uploads"}
                            </button>
                        </div>
                    )}
                </>
            ) : (
                !state.error && <p role="status">Checking your account storage…</p>
            )}
            {state.owner === userId && state.error && (
                <p
                    className="storage-error"
                    role="alert"
                >
                    {state.error}
                    <button
                        type="button"
                        className="text-button"
                        onClick={refresh}
                    >
                        Retry
                    </button>
                </p>
            )}
        </section>
    );
}
