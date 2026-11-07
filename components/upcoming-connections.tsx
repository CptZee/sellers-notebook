"use client";
import { MarketplaceSync } from "./marketplace-sync";
import { confirmAction } from "./confirm-dialog";
import { useEffect, useRef, useState } from "react";
import { Link2 } from "lucide-react";
type Fetched = {
    platform: "Lazada" | "TikTok Shop";
    shopId: string;
    rows: Record<string, string>[];
};
type Status = {
    orderImportAvailable: boolean;
    configured: boolean;
    connected: boolean;
    needsReconnect: boolean;
    account: { id: string; connectedAt: string } | null;
};

function MarketplaceConnection({
    platform,
    name,
    userId,
    disabled,
    onOrders,
}: {
    onOrders?: (data: Fetched) => void;
    platform: string;
    name: string;
    userId?: string;
    disabled: boolean;
}) {
    const alive = useRef(true),
        context = useRef(userId + "|" + platform);
    context.current = userId + "|" + platform;
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
        };
    }, []);
    const active = () => alive.current && context.current === userId + "|" + platform;
    const [status, setStatus] = useState<Status | null>(null),
        [error, setError] = useState(""),
        [busy, setBusy] = useState(false);
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }),
        [from, setFrom] = useState(today),
        [to, setTo] = useState(today),
        [shops, setShops] = useState<{ id: string; name: string; cipher: string }[]>([]),
        [cipher, setCipher] = useState("");
    const endpoint = `/api/marketplaces/${platform}`;
    useEffect(() => {
        let active = true;
        setStatus(null);
        if (userId)
            fetch(endpoint, { cache: "no-store", headers: { "X-Notebook-User": userId } })
                .then(async (r) => {
                    const data = await r.json();
                    if (!r.ok) throw Error(data.error);
                    if (active) setStatus(data);
                })
                .catch(() => {
                    if (active) setError("Could not check this connection. Refresh to retry.");
                });
        return () => {
            active = false;
        };
    }, [endpoint, userId]);
    async function act(disconnect = false) {
        if (!userId) return;
        if (
            disconnect &&
            !(await confirmAction(
                `Disconnect ${name}? Imported orders will remain. You can revoke authorization separately in ${name}.`,
            ))
        )
            return;
        setBusy(true);
        setError("");
        try {
            const response = await fetch(endpoint + (disconnect ? "" : "/connect"), {
                    method: disconnect ? "DELETE" : "POST",
                    headers: { "X-Notebook-User": userId },
                }),
                data = await response.json();
            if (!response.ok) throw Error(data.error || "Please try again.");
            if (!active()) return;
            if (disconnect)
                setStatus((old) =>
                    old ? { ...old, connected: false, account: null, needsReconnect: false } : old,
                );
            else location.assign(data.authorizationUrl);
        } catch (e) {
            if (active()) setError(e instanceof Error ? e.message : "Please try again.");
        } finally {
            if (active()) setBusy(false);
        }
    }
    async function fetchOrders() {
        if (!userId || !onOrders) return;
        setBusy(true);
        setError("");
        try {
            const response = await fetch(endpoint + "/orders", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "X-Notebook-User": userId },
                    body: JSON.stringify({ from, to, ...(cipher ? { shopCipher: cipher } : {}) }),
                }),
                data = await response.json();
            if (!response.ok) throw Error(data.error || "Could not fetch orders.");
            if (!active()) return;
            if (data.shops) setShops(data.shops);
            if (data.rows === null) {
                setError("Choose an authorized Philippines shop and fetch again.");
                return;
            }
            if (!Array.isArray(data.rows))
                throw Error("Could not read fetched orders. Please retry.");
            if (!data.rows.length) {
                setError("No orders were found in this date range.");
                return;
            }
            onOrders(data);
        } catch (e) {
            if (active()) setError(e instanceof Error ? e.message : "Could not fetch orders.");
        } finally {
            if (active()) setBusy(false);
        }
    }
    return (
        <section className="marketplace-row">
            <div>
                <h3>
                    <Link2 size={16} />
                    {name}
                </h3>
                <p>
                    {status?.connected
                        ? status.needsReconnect
                            ? "Authorization needs renewal. Disconnect and connect again."
                            : status.orderImportAvailable
                              ? "Account authorized · Fetch orders to review before saving"
                              : "Account authorized · Direct order sync is coming soon"
                        : status?.configured
                          ? "Ready to authorize your account. Direct order sync is coming soon."
                          : "Coming soon · Connection is being worked on"}
                </p>
                {status?.configured &&
                    status.connected &&
                    !status.needsReconnect &&
                    status.orderImportAvailable &&
                    onOrders && (
                        <div className="marketplace-fetch-controls">
                            <label className="field">
                                <span>{name} orders from</span>
                                <input
                                    aria-label={`${name} orders from`}
                                    type="date"
                                    max={to}
                                    value={from}
                                    onChange={(e) => setFrom(e.target.value)}
                                    disabled={busy || disabled}
                                />
                            </label>
                            <label className="field">
                                <span>{name} orders through</span>
                                <input
                                    aria-label={`${name} orders through`}
                                    type="date"
                                    min={from}
                                    max={today}
                                    value={to}
                                    onChange={(e) => setTo(e.target.value)}
                                    disabled={busy || disabled}
                                />
                            </label>
                            {shops.length > 1 && (
                                <label className="field">
                                    <span>Authorized shop</span>
                                    <select
                                        aria-label={`${name} authorized shop`}
                                        value={cipher}
                                        onChange={(e) => setCipher(e.target.value)}
                                        disabled={busy || disabled}
                                    >
                                        <option value="">Choose shop</option>
                                        {shops.map((s) => (
                                            <option
                                                key={s.id}
                                                value={s.cipher}
                                            >
                                                {s.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            )}
                            <button
                                className="button secondary"
                                disabled={busy || disabled}
                                onClick={() => void fetchOrders()}
                            >
                                {busy ? "Fetching…" : "Fetch " + name + " orders"}
                            </button>
                            <small>
                                Up to 30 days. Review fetched history before saving; current stock
                                stays unchanged.
                            </small>
                        </div>
                    )}
                {status?.connected && userId && onOrders && (
                    <MarketplaceSync
                        platform={platform}
                        name={name}
                        userId={userId}
                        shopCipher={cipher}
                        onOrders={onOrders}
                        disabled={busy || disabled}
                    />
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
            {status?.connected ? (
                <button
                    className="button secondary"
                    disabled={busy || disabled}
                    onClick={async () => void act(true)}
                >
                    Disconnect {name}
                </button>
            ) : (
                <button
                    className="button secondary"
                    disabled={!userId || !status?.configured || busy || disabled}
                    onClick={async () => void act()}
                >
                    {busy ? "Opening…" : `Connect ${name} shop`}
                </button>
            )}
        </section>
    );
}
export function UpcomingConnections({
    userId,
    disabled = false,
    onOrders,
}: {
    onOrders?: (data: Fetched) => void;
    userId?: string;
    disabled?: boolean;
}) {
    return (
        <div
            className="upcoming-connections"
            aria-label="More marketplace connections"
        >
            <MarketplaceConnection
                onOrders={onOrders}
                platform="lazada"
                name="Lazada"
                userId={userId}
                disabled={disabled}
            />
            <MarketplaceConnection
                onOrders={onOrders}
                platform="tiktok"
                name="TikTok Shop"
                userId={userId}
                disabled={disabled}
            />
        </div>
    );
}
