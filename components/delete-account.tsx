"use client";
import { useEffect, useState, useRef } from "react";
import { ConfirmDialog, confirmAction } from "./confirm-dialog";
type Receipt = { id: string; token: string };
const key = "notebook-account-deletion";
export function DeleteAccount() {
    const passwordInput = useRef<HTMLInputElement>(null);
    const [account, setAccount] = useState<{ available: boolean; email: string } | null>(null),
        [loading, setLoading] = useState(true),
        [error, setError] = useState(""),
        [receipt, setReceipt] = useState<Receipt | null>(null),
        [busy, setBusy] = useState(false),
        [phase, setPhase] = useState(""),
        [complete, setComplete] = useState(false),
        [attempt, setAttempt] = useState(0);
    useEffect(() => {
        let active = true;
        try {
            const pending = JSON.parse(sessionStorage.getItem(key) || "null");
            if (
                pending &&
                /^[0-9a-f-]{36}$/i.test(pending.id) &&
                typeof pending.token === "string" &&
                /^[A-Za-z0-9_-]{43}$/.test(pending.token)
            )
                setReceipt(pending);
        } catch {}
        void fetch("/api/account/deletion", { cache: "no-store" })
            .then(async (response) => {
                const data = await response.json();
                if (!active) return;
                if (response.ok) setAccount(data);
                else if (response.status !== 401)
                    setError(data.error || "Could not open account deletion.");
            })
            .catch(() => {
                if (active)
                    setError("Could not open account deletion. Reconnect and reload this page.");
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, []);
    useEffect(() => {
        if (!receipt) return;
        let active = true;
        setBusy(true);
        setError("");
        void (async () => {
            try {
                while (active) {
                    const response = await fetch("/api/account/deletion", {
                            method: "DELETE",
                            headers: {
                                "Content-Type": "application/json",
                                "X-Account-Deletion-Token": receipt.token,
                            },
                            body: JSON.stringify({ id: receipt.id }),
                        }),
                        data = await response.json();
                    if (!active) return;
                    if (!response.ok)
                        throw Error(data.error || "Deletion paused. Retry to finish.");
                    setPhase(data.phase);
                    if (data.phase === "complete") {
                        setComplete(true);
                        try {
                            sessionStorage.removeItem(key);
                        } catch {}
                        return;
                    }
                    await new Promise((resolve) => setTimeout(resolve, 250));
                }
            } catch (e) {
                if (active)
                    setError(
                        e instanceof Error ? e.message : "Deletion paused. Reconnect and retry.",
                    );
            } finally {
                if (active) setBusy(false);
            }
        })();
        return () => {
            active = false;
        };
    }, [receipt, attempt]);
    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy || !account?.available) return;
        setBusy(true);
        setError("");
        const form = new FormData(event.currentTarget);
        try {
            if (
                !(await confirmAction(
                    "Permanently delete this account, notebook records, uploaded files, profile picture and stored marketplace connections? This cannot be undone. Keep any backups and files you need first.",
                ))
            )
                return;
            const response = await fetch("/api/account/deletion", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        password: String(form.get("password")),
                        confirmation: String(form.get("confirmation")),
                        acknowledged: form.get("acknowledged") === "on",
                    }),
                }),
                data = await response.json();
            if (!response.ok) throw Error(data.error || "Could not start deletion.");
            const next = { id: data.id, token: data.token };
            try {
                sessionStorage.setItem(key, JSON.stringify(next));
            } catch {}
            setReceipt(next);
        } catch (e) {
            setError(
                e instanceof Error ? e.message : "Could not start deletion. Reconnect and retry.",
            );
        } finally {
            setBusy(false);
            requestAnimationFrame(() => passwordInput.current?.focus({ preventScroll: true }));
        }
    }
    return (
        <>
            <main
                className="auth-page"
                data-modal-root
            >
                {!receipt && !complete && (
                    <a
                        className="auth-back"
                        href="/notebook"
                    >
                        Back to notebook
                    </a>
                )}
                <section className="card auth-card">
                    <div className="eyebrow">ACCOUNT &amp; DATA</div>
                    <h1>{complete ? "Your notebook is closed." : "Delete your account"}</h1>
                    {complete ? (
                        <>
                            <p>
                                Your account, current notebook data, uploads and stored marketplace
                                connections have been removed.
                            </p>
                            <a
                                className="button primary"
                                href="/"
                            >
                                Back to home
                            </a>
                        </>
                    ) : receipt ? (
                        <>
                            <p role="status">
                                {busy
                                    ? `Removing ${phase === "records" ? "notebook records" : phase === "identity" ? "sign-in access" : "account data and files"}…`
                                    : "Deletion is paused."}
                            </p>
                            <p>
                                Keep this tab open until deletion finishes. New notebook activity is
                                blocked. If a service is unavailable, retry to remove the remaining
                                data.
                            </p>
                            {error && (
                                <p
                                    className="auth-error"
                                    role="alert"
                                >
                                    {error}
                                </p>
                            )}
                            {!busy && (
                                <button
                                    className="button primary"
                                    onClick={() => setAttempt((n) => n + 1)}
                                >
                                    Retry account deletion
                                </button>
                            )}
                        </>
                    ) : loading ? (
                        <p role="status">Opening account settings…</p>
                    ) : !account ? (
                        <>
                            <p>Sign in to confirm which account you want to remove.</p>
                            {error && (
                                <p
                                    className="auth-error"
                                    role="alert"
                                >
                                    {error}
                                </p>
                            )}
                            <a
                                className="button primary"
                                href="/auth/sign-in"
                            >
                                Sign in
                            </a>
                        </>
                    ) : (
                        <>
                            <p>{account.email}</p>
                            <p>
                                This permanently removes your account, notebook records, uploaded
                                files, profile picture, stored marketplace credentials and sync
                                batches.
                            </p>
                            <p>
                                Download your notebook backup and any files you need first. Your
                                marketplace accounts and records remain with their platforms.
                                Existing backups follow their separate retention settings.
                            </p>
                            <p>
                                Minimal deletion status is retained to finish interrupted cleanup
                                and prevent old sessions from recreating records.
                            </p>
                            {!account.available ? (
                                <p
                                    className="auth-error"
                                    role="alert"
                                >
                                    Account deletion is being prepared. Your data has not been
                                    changed.
                                </p>
                            ) : (
                                <form onSubmit={submit}>
                                    <fieldset disabled={busy}>
                                        <label className="field">
                                            <span>Current password</span>
                                            <input
                                                ref={passwordInput}
                                                name="password"
                                                type="password"
                                                autoComplete="current-password"
                                                required
                                                maxLength={1024}
                                            />
                                        </label>
                                        <label className="field">
                                            <span>Type DELETE to confirm</span>
                                            <input
                                                name="confirmation"
                                                required
                                                pattern="DELETE"
                                                autoComplete="off"
                                            />
                                        </label>
                                        <label className="import-confirm">
                                            <input
                                                type="checkbox"
                                                name="acknowledged"
                                                required
                                            />
                                            I understand this is permanent and have saved anything I
                                            need.
                                        </label>
                                        {error && (
                                            <p
                                                className="auth-error"
                                                role="alert"
                                            >
                                                {error}
                                            </p>
                                        )}
                                        <button
                                            className="button secondary cancel"
                                            disabled={busy}
                                            type="submit"
                                        >
                                            {busy ? "Checking…" : "Permanently delete account"}
                                        </button>
                                    </fieldset>
                                </form>
                            )}
                        </>
                    )}
                </section>
            </main>
            <ConfirmDialog stateKey={account?.email || "account-deletion"} />
        </>
    );
}
