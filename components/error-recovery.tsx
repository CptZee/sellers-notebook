"use client";
import { useEffect, useRef } from "react";

export function ErrorRecovery({ error, retry }: { error: unknown; retry: () => void }) {
    const heading = useRef<HTMLHeadingElement>(null);
    const digest =
        error instanceof Error &&
        "digest" in error &&
        typeof error.digest === "string" &&
        /^[a-f0-9-]{1,64}$/i.test(error.digest)
            ? error.digest
            : null;
    useEffect(() => {
        heading.current?.focus();
        if (!document.documentElement.dataset.theme) {
            try {
                document.documentElement.dataset.theme =
                    localStorage.getItem("notebook-theme") === "dark" ? "dark" : "light";
            } catch {
                document.documentElement.dataset.theme = "light";
            }
        }
    }, []);
    return (
        <main className="recovery-page">
            <style>{`
 .recovery-page{--paper:#faf8ef;--surface:#fffdf6;--ink:#354f41;--muted:#637567;--rule:#cad4c0;--accent:#4c7055;box-sizing:border-box;min-height:100dvh;padding:clamp(20px,6vw,72px);display:grid;place-items:center;background:var(--paper);color:var(--ink);font:16px/1.65 system-ui,sans-serif}
 html[data-theme="dark"] .recovery-page{--paper:#202630;--surface:#282e38;--ink:#e7eaf0;--muted:#b7c1d0;--rule:#465063;--accent:#bdd0ef}
 .recovery-card{box-sizing:border-box;width:100%;max-width:560px;border:1px solid var(--rule);border-left:6px solid var(--accent);border-radius:4px 12px 6px 4px;padding:clamp(24px,5vw,42px);background:var(--surface);overflow-wrap:anywhere}
 .recovery-card h1{font:normal clamp(28px,5vw,38px)/1.2 Georgia,serif;margin:12px 0 20px;color:var(--ink)}
 .recovery-card p{margin:12px 0;color:var(--muted)}.recovery-card .recovery-label{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink)}
 .recovery-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:26px}.recovery-actions button,.recovery-actions a{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:10px 18px;border:1px solid var(--accent);border-radius:5px;background:transparent;color:var(--ink);font:inherit;text-decoration:none;cursor:pointer}.recovery-actions button{background:var(--accent);color:var(--surface)}
 html[data-theme="dark"] .recovery-actions button{color:#1d2a40}.recovery-card :focus-visible{outline:3px solid var(--accent);outline-offset:4px}.recovery-reference{font-size:12px;font-variant-numeric:tabular-nums}
 `}</style>
            <section
                className="recovery-card"
                aria-labelledby="recovery-heading"
            >
                <p className="recovery-label">Seller’s Notebook</p>
                <h1
                    id="recovery-heading"
                    tabIndex={-1}
                    ref={heading}
                >
                    Let’s reopen this page.
                </h1>
                <p>Something interrupted the notebook. Try opening this page again.</p>
                <p>
                    Edits that had not finished saving may need to be entered again. Check your
                    saved records before repeating an entry.
                </p>
                {digest && <p className="recovery-reference">Error reference: {digest}</p>}
                <div className="recovery-actions">
                    <button
                        type="button"
                        onClick={retry}
                    >
                        Try again
                    </button>
                    <a href="/">Back to home</a>
                </div>
            </section>
        </main>
    );
}
