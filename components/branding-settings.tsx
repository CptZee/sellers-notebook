"use client";
import { useRef, useState } from "react";
import { NotebookPen, Store, Sprout } from "lucide-react";
import type { Branding } from "../lib/notebook-types";
export function BrandingMark({ icon, size = 23 }: { icon?: Branding["icon"]; size?: number }) {
    const Icon = icon === "store" ? Store : icon === "sprout" ? Sprout : NotebookPen;
    return <Icon size={size} />;
}
export function BrandingSettings({
    value,
    onSave,
    disabled,
}: {
    value: Branding | null;
    onSave: (value: Branding | null) => void;
    disabled: boolean;
}) {
    const baseline = useRef(JSON.stringify(value));
    const [draft, setDraft] = useState<Branding>(
        value || { businessName: "", notebookTitle: "", tagline: "", icon: "notebook" },
    );
    const [message, setMessage] = useState("");
    function save(next: Branding | null) {
        if (JSON.stringify(value) !== baseline.current) {
            setMessage(
                "Branding changed on another device. Close and reopen account settings to use the latest version.",
            );
            return;
        }
        if (next && (!next.businessName || !next.notebookTitle)) {
            setMessage("Enter a business name and notebook title.");
            return;
        }
        onSave(next);
        baseline.current = JSON.stringify(next);
        setMessage("Branding updated. Your notebook will save it automatically.");
        if (!next) setDraft({ businessName: "", notebookTitle: "", tagline: "", icon: "notebook" });
    }
    return (
        <section className="branding-settings">
            <h3>Make it your notebook</h3>
            <p>Personalize your private workspace.</p>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    save({
                        ...draft,
                        businessName: draft.businessName.trim(),
                        notebookTitle: draft.notebookTitle.trim(),
                        tagline: draft.tagline.trim(),
                    });
                }}
            >
                <fieldset disabled={disabled}>
                    <label className="field">
                        <span>Business name</span>
                        <input
                            required
                            maxLength={48}
                            value={draft.businessName}
                            placeholder="Your shop name"
                            onChange={(e) => setDraft({ ...draft, businessName: e.target.value })}
                        />
                    </label>
                    <label className="field">
                        <span>Notebook title</span>
                        <input
                            required
                            maxLength={40}
                            value={draft.notebookTitle}
                            placeholder="My little business notebook"
                            onChange={(e) => setDraft({ ...draft, notebookTitle: e.target.value })}
                        />
                    </label>
                    <label className="field">
                        <span>Business tagline (optional)</span>
                        <input
                            maxLength={100}
                            value={draft.tagline}
                            placeholder="A place for your business to grow."
                            onChange={(e) => setDraft({ ...draft, tagline: e.target.value })}
                        />
                    </label>
                    <label className="field">
                        <span>Notebook icon</span>
                        <select
                            aria-label="Notebook icon"
                            value={draft.icon}
                            onChange={(e) =>
                                setDraft({ ...draft, icon: e.target.value as Branding["icon"] })
                            }
                        >
                            <option value="notebook">Notebook</option>
                            <option value="store">Shop</option>
                            <option value="sprout">Sprout</option>
                        </select>
                    </label>
                    <div className="branding-preview">
                        <BrandingMark
                            icon={draft.icon}
                            size={28}
                        />
                        <div>
                            <strong>{draft.notebookTitle || "Seller’s Notebook"}</strong>
                            <span>{draft.businessName || "Your business name"}</span>
                            <small>{draft.tagline || "A place for your business to grow."}</small>
                        </div>
                    </div>
                    <div className="branding-actions">
                        <button
                            className="button secondary"
                            type="button"
                            onClick={() => save(null)}
                        >
                            Reset branding
                        </button>
                        <button
                            className="button primary"
                            type="submit"
                        >
                            Save branding
                        </button>
                    </div>
                </fieldset>
            </form>
            {message && (
                <p
                    role="status"
                    className="branding-message"
                >
                    {message}
                </p>
            )}
        </section>
    );
}
