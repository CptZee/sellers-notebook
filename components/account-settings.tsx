"use client";
import { LegalLinks } from "./legal-links";

import { useState } from "react";
import { authClient } from "../lib/auth/client";
import type { NotebookUser } from "../lib/use-notebook";
import type { Branding } from "../lib/notebook-types";
import { ProfilePicture } from "./profile-picture";
import { BrandingSettings } from "./branding-settings";
import { AccountStorage } from "./account-storage";
import { CursorToggle } from "./cursor-toggle";

export function AccountSettings({
    user,
    branding,
    onBranding,
    onProfileSaved,
    disabled,
    hasUnsaved,
    status,
    children,
    connections,
    profileActions,
}: {
    profileActions?: React.ReactNode;
    user: NotebookUser | null;
    branding: Branding | null;
    onBranding: (value: Branding | null) => void;
    onProfileSaved: () => Promise<void>;
    disabled: boolean;
    hasUnsaved: boolean;
    status: string;
    children: React.ReactNode;
    connections: React.ReactNode;
}) {
    const [tab, setTab] = useState("Profile"),
        [name, setName] = useState(user?.name || ""),
        [busy, setBusy] = useState(false),
        [message, setMessage] = useState(""),
        [error, setError] = useState("");
    const tabs = ["Profile", "Branding", "Connections", "Notebook"];
    async function save(e: React.FormEvent) {
        e.preventDefault();
        setMessage("");
        setError("");
        const next = name.trim();
        if (!next || next.length > 80) {
            setError("Use a display name between 1 and 80 characters.");
            return;
        }
        setBusy(true);
        try {
            const result = await authClient.updateUser({ name: next });
            if (result.error) throw Error(result.error.message || "Could not update your profile.");
            await onProfileSaved();
            setName(next);
            setMessage("Profile updated.");
        } catch (e) {
            setError(
                e instanceof Error ? e.message : "Could not update your profile. Please retry.",
            );
        } finally {
            setBusy(false);
        }
    }
    return (
        <div className="account-settings">
            <div
                className="account-tabs"
                role="tablist"
                aria-label="Account settings sections"
            >
                {tabs.map((item) => (
                    <button
                        key={item}
                        id={`settings-${item}`}
                        type="button"
                        role="tab"
                        aria-selected={tab === item}
                        aria-controls="settings-panel"
                        tabIndex={tab === item ? 0 : -1}
                        onClick={() => setTab(item)}
                        onKeyDown={(e) => {
                            if (["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) {
                                e.preventDefault();
                                const next =
                                    e.key === "Home"
                                        ? tabs[0]
                                        : e.key === "End"
                                          ? tabs.at(-1)!
                                          : tabs[
                                                (tabs.indexOf(item) +
                                                    (e.key === "ArrowRight"
                                                        ? 1
                                                        : tabs.length - 1)) %
                                                    tabs.length
                                            ];
                                setTab(next);
                                document.getElementById(`settings-${next}`)?.focus();
                            }
                        }}
                    >
                        {item}
                    </button>
                ))}
            </div>
            <div
                id="settings-panel"
                role="tabpanel"
                aria-labelledby={`settings-${tab}`}
                className="settings-panel"
            >
                {tab === "Profile" && (
                    <>
                        <ProfilePicture
                            user={user}
                            disabled={disabled || hasUnsaved || busy}
                            onSaved={onProfileSaved}
                        />
                        <p className="settings-intro">
                            Your name appears in your account and notebook.
                        </p>
                        <form
                            onSubmit={save}
                            className="profile-form"
                        >
                            <label className="field">
                                <span>Display name</span>
                                <input
                                    required
                                    maxLength={80}
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    disabled={disabled || busy}
                                />
                            </label>
                            <label className="field">
                                <span>Account email</span>
                                <input
                                    type="email"
                                    value={user?.email || ""}
                                    readOnly
                                />
                                <small>Your sign-in email stays the same.</small>
                            </label>
                            {error && (
                                <p
                                    className="auth-error"
                                    role="alert"
                                >
                                    {error}
                                </p>
                            )}
                            {message && (
                                <p
                                    className="auth-message"
                                    role="status"
                                >
                                    {message}
                                </p>
                            )}
                            <div className="settings-save">
                                <button
                                    className="button primary"
                                    disabled={disabled || busy || hasUnsaved}
                                    type="submit"
                                >
                                    {busy ? "Saving…" : "Save profile"}
                                </button>
                            </div>
                            {hasUnsaved && (
                                <small>Wait for notebook changes to finish saving.</small>
                            )}
                        </form>
                        {profileActions && (
                            <fieldset
                                className="profile-session-actions"
                                disabled={busy}
                            >
                                {profileActions}
                            </fieldset>
                        )}
                    </>
                )}
                {tab === "Branding" && (
                    <>
                        <BrandingSettings
                            value={branding}
                            onSave={onBranding}
                            disabled={disabled}
                        />
                        <div className="cursor-preference">
                            <h3>Your cursor</h3>
                            <p>
                                Use the notebook pencil or your standard cursor. This preference is
                                saved in this browser.
                            </p>
                            <CursorToggle inline />
                        </div>
                    </>
                )}
                {tab === "Connections" && connections}
                {tab === "Notebook" && (
                    <>
                        <p className="settings-intro">{status}</p>
                        {user && <AccountStorage userId={user.id} />}
                        {children}
                        <LegalLinks />
                        {user && (
                            <p>
                                <a
                                    className="text-button cancel"
                                    href="/account/delete"
                                    aria-disabled={disabled || hasUnsaved}
                                    onClick={(event) => {
                                        if (disabled || hasUnsaved) event.preventDefault();
                                    }}
                                >
                                    Delete my account
                                </a>
                            </p>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
