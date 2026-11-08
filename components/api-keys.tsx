"use client";
import { useEffect, useState } from "react";
type Key = {
    id: string;
    name: string;
    purpose: string;
    scope: string;
    prefix: string;
    expires_at: string;
    revoked_at: string | null;
};
export function ApiKeys() {
    const [keys, setKeys] = useState<Key[]>([]),
        [error, setError] = useState("");
    const [token, setToken] = useState(""),
        [busy, setBusy] = useState(false);
    async function load() {
        const response = await fetch("/api/account/api-keys");
        const data = await response.json();
        if (!response.ok) throw Error(data.error);
        setKeys(data.keys);
    }
    useEffect(() => {
        load().catch(() => setError("Could not load API keys. Refresh to retry."));
    }, []);
    async function create(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = event.currentTarget,
            input = new FormData(form);
        setBusy(true);
        setError("");
        setToken("");
        try {
            const response = await fetch("/api/account/api-keys", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(Object.fromEntries(input)),
            });
            const data = await response.json();
            if (!response.ok) throw Error(data.error);
            setToken(data.token);
            form.reset();
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not create API key.");
        } finally {
            setBusy(false);
        }
    }
    async function revoke(id: string) {
        setBusy(true);
        setError("");
        setToken("");
        try {
            const response = await fetch(`/api/account/api-keys?id=${id}`, { method: "DELETE" });
            if (!response.ok) throw Error("Could not revoke this key. Retry.");
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not revoke API key.");
        } finally {
            setBusy(false);
        }
    }
    return (
        <>
            <form onSubmit={create}>
                <p>
                    <label>
                        Key name{" "}
                        <input
                            name="name"
                            required
                            maxLength={80}
                            placeholder="My integration or phone"
                        />
                    </label>
                </p>
                <p>
                    <label>
                        Use{" "}
                        <select name="purpose">
                            <option value="public">Public integration</option>
                            <option value="mobile">Mobile device</option>
                        </select>
                    </label>
                </p>
                <p>
                    <label>
                        Access{" "}
                        <select name="scope">
                            <option value="read">Read only</option>
                            <option value="write">Read and write</option>
                        </select>
                    </label>
                </p>
                <button
                    className="button primary"
                    disabled={busy}
                >
                    Create API key
                </button>
            </form>
            {error && <p role="alert">{error}</p>}
            {token && (
                <div role="status">
                    <p>Copy this key now. It will only be shown once. Keep it private.</p>
                    <textarea
                        aria-label="New API key"
                        readOnly
                        value={token}
                        rows={3}
                        style={{ width: "100%" }}
                    />
                    <button
                        className="button secondary"
                        onClick={() => setToken("")}
                    >
                        Dismiss key
                    </button>
                </div>
            )}
            <h2>Your keys</h2>
            {!keys.length && <p>No API keys yet.</p>}
            {keys.map((key) => (
                <div key={key.id}>
                    <p>
                        <strong>{key.name}</strong> — {key.purpose},{" "}
                        {key.scope === "read" ? "read only" : "read and write"}
                        <br />
                        <code>{key.prefix}…</code> · Expires{" "}
                        {new Date(key.expires_at).toLocaleDateString()}
                    </p>
                    {key.revoked_at ? (
                        <p>Revoked</p>
                    ) : (
                        <button
                            className="button secondary"
                            disabled={busy}
                            onClick={() => revoke(key.id)}
                        >
                            Revoke {key.name}
                        </button>
                    )}
                </div>
            ))}
        </>
    );
}
