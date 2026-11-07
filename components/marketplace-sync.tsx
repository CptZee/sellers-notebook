"use client";
import { useEffect, useRef, useState } from "react";
type Run = {
    id: string;
    status: string;
    attempts: number;
    from: string;
    to: string;
    rows: number;
    error: string | null;
    createdAt: string;
};
type Data = {
    available: boolean;
    settings: {
        enabled: boolean;
        intervalMinutes: number;
        lookbackDays: number;
        shopCipher: string | null;
        nextRunAt: string;
    } | null;
    total: number;
    runs: Run[];
};
type Fetched = {
    platform: "Lazada" | "TikTok Shop";
    shopId: string;
    rows: Record<string, string>[];
};
export function MarketplaceSync({
    platform,
    name,
    userId,
    shopCipher,
    onOrders,
    disabled,
}: {
    platform: string;
    name: string;
    userId: string;
    shopCipher: string;
    onOrders: (data: Fetched) => void;
    disabled: boolean;
}) {
    const alive = useRef(true),
        ownerContext = useRef(userId + "|" + platform);
    ownerContext.current = userId + "|" + platform;
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
        };
    }, []);
    const active = () => alive.current && ownerContext.current === userId + "|" + platform;
    const [open, setOpen] = useState(false),
        [page, setPage] = useState(1),
        [attempt, setAttempt] = useState(0),
        [enabled, setEnabled] = useState(false),
        [interval, setInterval] = useState(360),
        [days, setDays] = useState(2),
        [busy, setBusy] = useState(false),
        [error, setError] = useState("");
    const key = JSON.stringify([userId, platform, page, attempt]),
        [state, setState] = useState<{ key: string; data?: Data; error?: string }>({ key: "" }),
        initialized = useRef(""),
        data = state.key === key ? state.data : undefined,
        endpoint = "/api/marketplaces/" + platform + "/sync";
    useEffect(() => {
        if (!open) return;
        const controller = new AbortController();
        void fetch(endpoint + "?page=" + page, {
            cache: "no-store",
            headers: { "X-Notebook-User": userId },
            signal: controller.signal,
        })
            .then(async (response) => {
                const result = await response.json();
                if (!response.ok) throw Error(result.error || "Could not load sync history.");
                if (controller.signal.aborted) return;
                setState({ key, data: result });
                const ownerKey = userId + "|" + platform;
                if (initialized.current !== ownerKey) {
                    initialized.current = ownerKey;
                    setEnabled(result.settings?.enabled || false);
                    setInterval(result.settings?.intervalMinutes || 360);
                    setDays(result.settings?.lookbackDays || 2);
                }
            })
            .catch((e) => {
                if (!controller.signal.aborted) setState({ key, error: e.message });
            });
        return () => controller.abort();
    }, [key, open]);
    async function write(body: Record<string, unknown>) {
        setBusy(true);
        setError("");
        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Notebook-User": userId },
                body: JSON.stringify(body),
            });
            if (!response.ok)
                throw Error((await response.json()).error || "Could not save sync settings.");
            if (!active()) return;
            if (body.action === "configure") setEnabled(Boolean(body.enabled));
            setAttempt((n) => n + 1);
        } catch (e) {
            if (active())
                setError(e instanceof Error ? e.message : "Could not save sync settings.");
        } finally {
            if (active()) setBusy(false);
        }
    }
    async function review(id: string) {
        setBusy(true);
        setError("");
        try {
            const response = await fetch(endpoint + "?run=" + id, {
                    cache: "no-store",
                    headers: { "X-Notebook-User": userId },
                }),
                result = await response.json();
            if (!response.ok) throw Error(result.error || "Could not open this batch.");
            if (!active()) return;
            onOrders(result);
        } catch (e) {
            if (active()) setError(e instanceof Error ? e.message : "Could not open this batch.");
        } finally {
            if (active()) setBusy(false);
        }
    }
    return (
        <details
            className="marketplace-sync"
            onToggle={(e) => setOpen(e.currentTarget.open)}
        >
            <summary>{name} scheduled fetches &amp; history</summary>
            {open && (
                <div className="marketplace-sync-body">
                    {!data ? (
                        <p role="status">
                            {(state.key === key && state.error) || "Opening sync history…"}
                            <button
                                className="text-button"
                                onClick={() => setAttempt((n) => n + 1)}
                            >
                                Refresh sync history
                            </button>
                        </p>
                    ) : (
                        <>
                            <p className="import-note">
                                Scheduled fetches prepare batches for your review. They never save
                                sales or change stock automatically. Existing order lines are
                                skipped during import.
                            </p>
                            {!data.available && (
                                <p className="import-note">
                                    Coming soon · Scheduled fetching is not configured yet. CSV
                                    imports remain available.
                                </p>
                            )}
                            <div className="marketplace-sync-fields">
                                <label className="import-confirm">
                                    <input
                                        type="checkbox"
                                        aria-label={`Enable ${name} scheduled fetches`}
                                        checked={enabled}
                                        onChange={(e) => setEnabled(e.target.checked)}
                                        disabled={!data.available || busy || disabled}
                                    />
                                    Enable scheduled fetches for this connected shop
                                </label>
                                <label className="field">
                                    <span>Fetch frequency</span>
                                    <select
                                        aria-label={`${name} fetch frequency`}
                                        value={interval}
                                        onChange={(e) => setInterval(Number(e.target.value))}
                                        disabled={!data.available || busy || disabled}
                                    >
                                        <option value={60}>Hourly</option>
                                        <option value={360}>Every six hours</option>
                                        <option value={1440}>Daily</option>
                                    </select>
                                </label>
                                <label className="field">
                                    <span>Days to look back</span>
                                    <input
                                        aria-label={`${name} sync lookback days`}
                                        type="number"
                                        min={1}
                                        max={7}
                                        step={1}
                                        value={days}
                                        onChange={(e) => setDays(Number(e.target.value))}
                                        disabled={!data.available || busy || disabled}
                                    />
                                </label>
                                <button
                                    className="button secondary"
                                    disabled={!data.available || busy || disabled}
                                    onClick={() =>
                                        void write({
                                            action: "configure",
                                            enabled,
                                            intervalMinutes: interval,
                                            lookbackDays: days,
                                            ...(shopCipher || data.settings?.shopCipher
                                                ? {
                                                      shopCipher:
                                                          shopCipher || data.settings?.shopCipher,
                                                  }
                                                : {}),
                                        })
                                    }
                                >
                                    Save {name} schedule
                                </button>
                                {data.settings?.enabled && (
                                    <button
                                        className="text-button"
                                        disabled={busy || disabled}
                                        onClick={() =>
                                            void write({
                                                action: "configure",
                                                enabled: false,
                                                intervalMinutes: interval,
                                                lookbackDays: days,
                                            })
                                        }
                                    >
                                        Turn off {name} schedule
                                    </button>
                                )}
                            </div>
                            <p className="import-note">
                                Use Fetch orders first to select a shop when your account has
                                several. Turning off cancels queued work; ready batches remain
                                available while the same shop is connected. Reconnecting requires a
                                new opt-in.
                            </p>
                            <button
                                className="text-button"
                                disabled={busy}
                                onClick={() => setAttempt((n) => n + 1)}
                            >
                                Refresh {name} sync history
                            </button>
                            {data.runs.map((run) => (
                                <div
                                    className="sync-run"
                                    key={run.id}
                                >
                                    <strong>
                                        {run.from} – {run.to}
                                    </strong>
                                    <span>
                                        {run.status === "ready" ? "Ready for preview" : run.status}{" "}
                                        · {run.rows} fetched lines · {run.attempts}/3 attempts
                                    </span>
                                    {run.error && <p role="status">{run.error}</p>}
                                    {run.status === "ready" && run.rows > 0 && (
                                        <button
                                            className="text-button"
                                            disabled={busy || disabled}
                                            onClick={() => void review(run.id)}
                                        >
                                            Open {name} batch preview
                                        </button>
                                    )}
                                    {["failed", "cancelled"].includes(run.status) && (
                                        <button
                                            className="text-button"
                                            disabled={
                                                !data.available ||
                                                !data.settings?.enabled ||
                                                busy ||
                                                disabled
                                            }
                                            onClick={() =>
                                                void write({ action: "retry", id: run.id })
                                            }
                                        >
                                            Retry {name} fetch
                                        </button>
                                    )}
                                </div>
                            ))}
                            {!data.total && (
                                <p className="import-note">No scheduled fetches yet.</p>
                            )}
                            <div className="supplier-actions">
                                <button
                                    className="text-button"
                                    disabled={page <= 1 || busy}
                                    onClick={() => setPage((n) => n - 1)}
                                >
                                    Previous {name} sync page
                                </button>
                                <small>
                                    Page {page} · {data.total} fetches
                                </small>
                                <button
                                    className="text-button"
                                    disabled={page * 25 >= data.total || busy}
                                    onClick={() => setPage((n) => n + 1)}
                                >
                                    Next {name} sync page
                                </button>
                            </div>
                        </>
                    )}
                    {error && (
                        <p
                            className="auth-error"
                            role="alert"
                        >
                            {error}
                        </p>
                    )}
                </div>
            )}
        </details>
    );
}
