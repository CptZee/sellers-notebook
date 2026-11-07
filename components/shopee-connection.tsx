"use client";
import { confirmAction } from "./confirm-dialog";
import { useCallback, useEffect, useState } from "react";
import { Link2, RefreshCw } from "lucide-react";
export type ShopeeFetched = {
    platform?: "Shopee" | "Lazada" | "TikTok Shop";
    shopId: string;
    rows: Record<string, string>[];
};
type Status = {
    configured: boolean;
    environment: string;
    callbackUrl: string | null;
    connected: boolean;
    shop: { shopId: string; lastFetchedAt: string | null } | null;
};
export function ShopeeConnection({
    userId,
    disabled,
    onOrders,
}: {
    userId: string;
    disabled: boolean;
    onOrders: (data: ShopeeFetched) => void;
}) {
    const [status, setStatus] = useState<Status | null>(null),
        [busy, setBusy] = useState(false),
        [error, setError] = useState(""),
        [notice, setNotice] = useState("");
    const localDate = (date: Date) => date.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    const [from, setFrom] = useState(() => localDate(new Date(Date.now() - 6 * 86400000))),
        [to, setTo] = useState(() => localDate(new Date()));
    const headers = { "X-Notebook-User": userId };
    const load = useCallback(async () => {
        const r = await fetch("/api/shopee", {
            cache: "no-store",
            headers: { "X-Notebook-User": userId },
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Could not load the connection.");
        setStatus(data);
    }, [userId]);
    useEffect(() => {
        let active = true;
        setError("");
        load().catch((e) => {
            if (active) setError(e.message);
        });
        return () => {
            active = false;
        };
    }, [load]);
    async function connect() {
        setBusy(true);
        setError("");
        try {
            const r = await fetch("/api/shopee/connect", { method: "POST", headers });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error);
            location.assign(data.authorizationUrl);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not start authorization.");
            setBusy(false);
        }
    }
    async function disconnect() {
        if (
            !(await confirmAction(
                "Disconnect this shop from your notebook? Imported orders remain. You can revoke the app’s authorization separately in Shopee.",
            ))
        )
            return;
        setBusy(true);
        setError("");
        try {
            const r = await fetch("/api/shopee", { method: "DELETE", headers });
            if (!r.ok) throw new Error("Could not disconnect your shop.");
            await load();
            setNotice("Shop disconnected. Your imported orders are still here.");
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not disconnect.");
        } finally {
            setBusy(false);
        }
    }
    async function fetchOrders() {
        setBusy(true);
        setError("");
        setNotice("");
        try {
            const r = await fetch("/api/shopee/orders", {
                method: "POST",
                headers: { ...headers, "Content-Type": "application/json" },
                body: JSON.stringify({ from, to }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error);
            if (!data.rows.length) setNotice("No updated orders were found in that date range.");
            else {
                onOrders(data);
                setNotice(
                    `${data.rows.length} item lines are ready to review below. Nothing has been imported yet.`,
                );
            }
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not fetch your orders.");
        } finally {
            setBusy(false);
        }
    }
    return (
        <section className="marketplace-connection">
            <div className="marketplace-row">
                <div>
                    <h3>
                        <Link2 size={16} />
                        Shopee
                    </h3>
                    <p>
                        {status && !status.configured
                            ? "Coming soon · Connection is being worked on"
                            : status?.connected
                              ? `Shop ${status.shop?.shopId} · ${status.environment === "sandbox" ? "Sandbox connection" : "Connected"}`
                              : "Authorize your shop to fetch orders for review."}
                    </p>
                </div>
                {!status?.connected && (
                    <button
                        className="button secondary"
                        disabled={!status?.configured || busy || disabled}
                        onClick={async () => void connect()}
                    >
                        {busy ? "Opening…" : "Connect Shopee shop"}
                    </button>
                )}
                {status?.connected && (
                    <button
                        className="button secondary"
                        disabled={busy || disabled}
                        onClick={async () => void disconnect()}
                    >
                        Disconnect Shopee
                    </button>
                )}
            </div>
            {error && (
                <div
                    className="auth-error"
                    role="alert"
                >
                    {error}{" "}
                    <button
                        className="text-button"
                        onClick={async () => {
                            setError("");
                            load().catch((e) => setError(e.message));
                        }}
                    >
                        Retry connection status
                    </button>
                </div>
            )}
            {notice && (
                <p
                    className="auth-message"
                    role="status"
                >
                    {notice}
                </p>
            )}
            {status?.connected && (
                <div className="marketplace-tools">
                    <div className="shopee-dates">
                        <label className="field">
                            <span>Updated from</span>
                            <input
                                type="date"
                                required
                                value={from}
                                onChange={(e) => setFrom(e.target.value)}
                                max={to}
                            />
                        </label>
                        <label className="field">
                            <span>Updated through</span>
                            <input
                                type="date"
                                required
                                value={to}
                                onChange={(e) => setTo(e.target.value)}
                                max={localDate(new Date())}
                                min={from}
                            />
                        </label>
                        <button
                            className="button secondary"
                            disabled={busy || disabled || !status.configured}
                            onClick={async () => void fetchOrders()}
                        >
                            <RefreshCw size={15} />
                            {busy ? "One moment…" : "Fetch orders for review"}
                        </button>
                    </div>
                    <p className="import-note">
                        Choose up to 14 days of order updates, with at most 200 orders per fetch.
                        Review before importing; current stock is preserved and existing lines are
                        skipped.
                    </p>
                    {status.shop?.lastFetchedAt && (
                        <small className="shopee-last-fetched">
                            Last fetched:{" "}
                            {new Date(status.shop.lastFetchedAt).toLocaleString("en-PH", {
                                timeZone: "Asia/Manila",
                            })}
                        </small>
                    )}
                </div>
            )}
        </section>
    );
}
