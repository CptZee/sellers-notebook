"use client";
import { useEffect, useMemo, useState } from "react";
import type { CloudNotebook } from "../lib/use-notebook-view";
import { CollapsibleCard } from "./collapsible-card";
import { Pagination } from "./pagination";
import { usePagination } from "../lib/use-pagination";
import { readSupplierCsv, previewSupplierImport } from "../lib/supplier-import.mjs";
import type { Supplier, Product } from "../lib/notebook-types";
export function SupplierImport({
    suppliers,
    products,
    onImport,
    onClose,
    disabled,
    cloud,
    onSave,
}: {
    cloud?: CloudNotebook;
    onSave?: (suppliers: Supplier[], revision: number) => Promise<void>;
    suppliers: Supplier[];
    products: Product[];
    onImport: (suppliers: Supplier[]) => void;
    onClose: () => void;
    disabled: boolean;
}) {
    const [data, setData] = useState<ReturnType<typeof readSupplierCsv> | null>(null),
        [error, setError] = useState(""),
        [reviewed, setReviewed] = useState(false),
        [message, setMessage] = useState("");
    const localPreview = useMemo(
        () =>
            !cloud && data
                ? previewSupplierImport(data.rows, data.mapping, suppliers, products)
                : null,
        [data, suppliers, products, cloud],
    );
    const [source, setSource] = useState(""),
        [saving, setSaving] = useState(false),
        [attempt, setAttempt] = useState(0);
    const key = JSON.stringify([cloud?.userId, cloud?.revision, source]),
        [remote, setRemote] = useState<{
            key: string;
            preview?: ReturnType<typeof previewSupplierImport>;
            products?: { id: string; sku: string }[];
            error?: string;
        }>({ key: "" });
    const preview = cloud ? (remote.key === key ? remote.preview : null) : localPreview,
        labels = cloud ? (remote.key === key ? remote.products || [] : []) : products;
    useEffect(() => {
        setReviewed(false);
        if (!cloud || !source) return;
        const controller = new AbortController();
        void fetch("/api/notebook/supplier-import", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Notebook-User": cloud.userId },
            body: JSON.stringify({ mode: "preview", revision: cloud.revision, text: source }),
            signal: controller.signal,
        })
            .then(async (response) => {
                const result = await response.json();
                if (!response.ok) throw Error(result.error || "Could not preview suppliers.");
                if (!controller.signal.aborted)
                    setRemote({ key, preview: result, products: result.products });
            })
            .catch((e) => {
                if (!controller.signal.aborted) setRemote({ key, error: e.message });
            });
        return () => controller.abort();
    }, [key, attempt]);
    const fingerprint = JSON.stringify(preview?.suppliers.map((s) => [s.name, s.productIds]));
    const [reviewKey, setReviewKey] = useState("");
    const paging = usePagination(preview?.suppliers || [], fingerprint);
    async function choose(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        setData(null);
        setSource("");
        setError("");
        setMessage("");
        setReviewed(false);
        try {
            if (file.size > 2 * 1024 * 1024) throw Error("Choose a CSV file up to 2 MB.");
            const text = await file.text();
            setData(readSupplierCsv(text));
            setSource(text);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not read this CSV.");
        }
    }
    function template() {
        const text =
            "Supplier,Contact person,Email,Phone,Address,Lead time (days),Product SKUs,Notes\r\nExample supplier,Alex,supplier@example.com,,,7,,Example contact only\r\n";
        const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = "supplier-template.csv";
        a.click();
        URL.revokeObjectURL(url);
    }
    return (
        <CollapsibleCard
            className="import-card"
            title="Bring your supplier contacts along"
            description="Preview your supplier CSV and check product links before saving."
            actions={
                <button
                    className="icon-button"
                    aria-label="Close supplier importer"
                    disabled={saving}
                    onClick={onClose}
                >
                    ×
                </button>
            }
        >
            <div className="import-body">
                <div className="import-start">
                    <label className="button secondary upload-button">
                        Choose supplier CSV
                        <input
                            type="file"
                            accept=".csv,text/csv"
                            aria-label="Choose supplier CSV"
                            disabled={saving}
                            onChange={choose}
                        />
                    </label>
                    <button
                        className="text-button"
                        onClick={template}
                    >
                        Supplier template
                    </button>
                </div>
                <p className="import-note">
                    Use the template headers or a supplier export. Only Supplier is required.
                    Separate Product SKUs with semicolons; products must already exist. Existing
                    supplier names are skipped, ignoring case. Contacts and stock are never
                    overwritten. Up to 1,000 rows and 2 MB.
                </p>
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
                {data && cloud && !preview && (
                    <p role="status">
                        {(remote.key === key && remote.error) ||
                            "Checking supplier contacts and product links…"}
                        {remote.key === key && remote.error && (
                            <button
                                className="text-button"
                                onClick={() => setAttempt((n) => n + 1)}
                            >
                                Retry supplier preview
                            </button>
                        )}
                    </p>
                )}
                {preview && (
                    <>
                        <div className="import-summary">
                            <strong>{preview.suppliers.length} new suppliers</strong>
                            <span>{preview.duplicates} existing suppliers skipped</span>
                            <span>{preview.errors.length} issues</span>
                        </div>
                        {!!preview.errors.length && (
                            <div
                                className="import-errors"
                                role="alert"
                            >
                                {preview.errors.slice(0, 12).map((issue, i) => (
                                    <p key={i}>
                                        {issue.row ? `Row ${issue.row}: ` : ""}
                                        {issue.message}
                                    </p>
                                ))}
                                {preview.errors.length > 12 && (
                                    <p>And {preview.errors.length - 12} more issues.</p>
                                )}
                            </div>
                        )}
                        <div className="table-scroll">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Supplier</th>
                                        <th>Email / phone</th>
                                        <th>Lead time</th>
                                        <th>Linked products</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paging.items.map((s) => (
                                        <tr key={s.id}>
                                            <td>
                                                {s.name}
                                                <small>{s.contact}</small>
                                            </td>
                                            <td>
                                                {s.email}
                                                <small>{s.phone}</small>
                                            </td>
                                            <td>{s.leadTimeDays || "Unspecified"}</td>
                                            <td>
                                                {labels
                                                    .filter((p) => s.productIds.includes(p.id))
                                                    .map((p) => p.sku)
                                                    .join(", ") || "None"}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <Pagination
                            label="Supplier preview"
                            {...paging}
                        />
                        <label className="import-confirm">
                            <input
                                type="checkbox"
                                disabled={saving}
                                checked={reviewed && reviewKey === fingerprint}
                                onChange={(e) => {
                                    setReviewed(e.target.checked);
                                    setReviewKey(fingerprint);
                                }}
                            />
                            I’ve checked the supplier details and product links.
                        </label>
                        <div className="import-actions">
                            <small>No changes to inventory or financial totals.</small>
                            <button
                                className="button primary"
                                disabled={
                                    disabled ||
                                    saving ||
                                    !reviewed ||
                                    reviewKey !== fingerprint ||
                                    !preview.suppliers.length ||
                                    !!preview.errors.length
                                }
                                onClick={async () => {
                                    setSaving(true);
                                    setError("");
                                    try {
                                        if (cloud) {
                                            if (!onSave) throw Error("Reconnect before importing.");
                                            await onSave(preview.suppliers, cloud.revision);
                                        } else onImport(preview.suppliers);
                                        setData(null);
                                        setSource("");
                                        setReviewed(false);
                                        setMessage(
                                            cloud
                                                ? "Supplier contacts saved."
                                                : "Supplier contacts added. Your notebook saves them automatically.",
                                        );
                                    } catch (e) {
                                        setError(
                                            e instanceof Error
                                                ? e.message
                                                : "Could not save suppliers.",
                                        );
                                    } finally {
                                        setSaving(false);
                                    }
                                }}
                            >
                                Add {preview.suppliers.length} suppliers
                            </button>
                        </div>
                    </>
                )}
            </div>
        </CollapsibleCard>
    );
}
