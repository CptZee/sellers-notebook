"use client";
import type { CloudNotebook } from "../lib/use-notebook-view";
import { CollapsibleCard } from "./collapsible-card";
import { Pagination } from "./pagination";
import { usePagination } from "../lib/use-pagination";
import { useEffect, useMemo, useState } from "react";
import { Upload, X, Download } from "lucide-react";
import {
    inventoryFields,
    readInventoryCsv,
    previewInventoryImport,
} from "../lib/inventory-import.mjs";
import type { Product } from "../lib/notebook-types";
export function InventoryImport({
    products,
    onImport,
    onClose,
    disabled,
    cloud,
    onSave,
}: {
    cloud?: CloudNotebook;
    onSave?: (products: Product[], revision: number) => Promise<void>;
    products: Product[];
    onImport: (products: Product[]) => void;
    onClose: () => void;
    disabled: boolean;
}) {
    const [data, setData] = useState<ReturnType<typeof readInventoryCsv> | null>(null),
        [error, setError] = useState(""),
        [file, setFile] = useState(""),
        [reviewed, setReviewed] = useState(false),
        [message, setMessage] = useState("");
    const localPreview = useMemo(
        () => (!cloud && data ? previewInventoryImport(data.rows, data.mapping, products) : null),
        [data, products],
    );
    const [attempt, setAttempt] = useState(0),
        [saving, setSaving] = useState(false),
        [savedInput, setSavedInput] = useState("");
    const previewKey = JSON.stringify([cloud?.userId, cloud?.revision, data?.rows, data?.mapping]),
        [remote, setRemote] = useState<{
            key: string;
            preview?: ReturnType<typeof previewInventoryImport>;
            error?: string;
        }>({ key: "" });
    const preview = cloud ? (remote.key === previewKey ? remote.preview : null) : localPreview;
    useEffect(() => {
        setReviewed(false);
        if (!cloud || !data) return;
        const controller = new AbortController();
        const timer = setTimeout(() => {
            void fetch("/api/notebook/inventory-import", {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Notebook-User": cloud.userId },
                body: JSON.stringify({
                    mode: "preview",
                    revision: cloud.revision,
                    rows: data.rows,
                    mapping: data.mapping,
                }),
                signal: controller.signal,
            })
                .then(async (response) => {
                    const result = await response.json();
                    if (!response.ok) throw Error(result.error || "Could not preview inventory.");
                    if (!controller.signal.aborted) setRemote({ key: previewKey, preview: result });
                })
                .catch((e) => {
                    if (!controller.signal.aborted)
                        setRemote({ key: previewKey, error: e.message });
                });
        }, 250);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [previewKey, attempt]);
    const paging = usePagination(
        preview?.products || [],
        file + "|" + JSON.stringify(data?.mapping || {}),
        10,
    );
    async function choose(e: React.ChangeEvent<HTMLInputElement>) {
        const chosen = e.target.files?.[0];
        e.target.value = "";
        if (!chosen) return;
        setError("");
        setData(null);
        setMessage("");
        setReviewed(false);
        try {
            if (chosen.size > 2 * 1024 * 1024) throw Error("Choose a CSV up to 2 MB.");
            setData(readInventoryCsv(await chosen.text()));
            setFile(chosen.name);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not read this CSV.");
        }
    }
    function template() {
        const url = URL.createObjectURL(
            new Blob(
                [
                    "Product name,SKU,Unit cost,Selling price,Stock,Category,Currency,Reorder point,Target stock\r\nCanvas Tote,TOTE-001,145.00,349.00,42,Bags,PHP,10,20\r\n",
                ],
                { type: "text/csv" },
            ),
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = "inventory-template.csv";
        link.click();
        URL.revokeObjectURL(url);
    }
    return (
        <CollapsibleCard
            className="import-card"
            title={<>Fill your product pages</>}
            description={<> Add new products from a CSV. Existing SKUs and stock are preserved. </>}
            actions={
                <>
                    {" "}
                    <button
                        className="icon-button"
                        aria-label="Close inventory importer"
                        disabled={saving}
                        onClick={onClose}
                    >
                        <X size={19} />
                    </button>{" "}
                </>
            }
        >
            <div className="import-body">
                <div className="import-start">
                    <label className="button secondary upload-button">
                        <Upload size={16} />
                        Choose inventory CSV
                        <input
                            aria-label="Choose inventory CSV"
                            type="file"
                            accept=".csv,text/csv"
                            disabled={saving}
                            onChange={choose}
                        />
                    </label>
                    <button
                        className="text-button"
                        onClick={template}
                    >
                        <Download size={14} />
                        Inventory template
                    </button>
                    {data && (
                        <small>
                            {file} · {data.rows.length} rows
                        </small>
                    )}
                </div>
                <p className="import-note">
                    Use one row per SKU. Import the stock you have now, not historical order
                    quantities. PHP only; up to 1,000 rows and 2 MB per file.
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
                {data && (
                    <div className="import-mapping">
                        {inventoryFields.map((field) => (
                            <label
                                className="field"
                                key={field.key}
                            >
                                <span>
                                    {field.label}
                                    {field.required ? " *" : ""}
                                </span>
                                <select
                                    disabled={saving}
                                    aria-label={`Inventory column: ${field.label}`}
                                    value={data.mapping[field.key] || ""}
                                    onChange={(e) => {
                                        setData({
                                            ...data,
                                            mapping: {
                                                ...data.mapping,
                                                [field.key]: e.target.value,
                                            },
                                        });
                                        setReviewed(false);
                                    }}
                                >
                                    <option value="">
                                        {field.required ? "Select a column" : "Not included"}
                                    </option>
                                    {data.headers.map((header) => (
                                        <option key={header}>{header}</option>
                                    ))}
                                </select>
                            </label>
                        ))}
                    </div>
                )}
                {data && cloud && !preview && (
                    <p role="status">
                        {(remote.key === previewKey && remote.error) || "Checking inventory…"}
                        {remote.key === previewKey && remote.error && (
                            <button
                                className="text-button"
                                onClick={() => setAttempt((n) => n + 1)}
                            >
                                Retry inventory preview
                            </button>
                        )}
                    </p>
                )}
                {data && preview && (
                    <>
                        <div className="import-summary">
                            <strong>{preview.products.length} new products</strong>
                            <span>{preview.duplicates} existing SKUs skipped</span>
                            <span>{preview.errors.length} issues</span>
                        </div>
                        {preview.errors.length > 0 && (
                            <div
                                className="import-errors"
                                role="alert"
                            >
                                <ul>
                                    {preview.errors.slice(0, 12).map((issue, index) => (
                                        <li key={index}>
                                            {issue.row ? `Row ${issue.row}: ` : ""}
                                            {issue.message}
                                        </li>
                                    ))}
                                </ul>
                                {preview.errors.length > 12 && (
                                    <p>And {preview.errors.length - 12} more issues.</p>
                                )}
                            </div>
                        )}
                        <div className="table-scroll">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Product / SKU</th>
                                        <th>Category</th>
                                        <th>Unit cost</th>
                                        <th>Selling price</th>
                                        <th>Stock</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paging.items.map((product) => (
                                        <tr key={product.id}>
                                            <td>
                                                {product.name}
                                                <small>{product.sku}</small>
                                            </td>
                                            <td>{product.category}</td>
                                            <td>₱{product.cost.toFixed(2)}</td>
                                            <td>₱{product.price.toFixed(2)}</td>
                                            <td>{product.stock}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <Pagination
                            label="Inventory preview"
                            {...paging}
                        />
                        <label className="import-confirm">
                            <input
                                type="checkbox"
                                disabled={saving}
                                checked={reviewed}
                                onChange={(e) => setReviewed(e.target.checked)}
                            />
                            I’ve checked product prices and current stock.
                        </label>
                        <div className="import-actions">
                            <small>Existing products are never overwritten.</small>
                            <button
                                className="button primary"
                                disabled={
                                    disabled ||
                                    saving ||
                                    savedInput === previewKey ||
                                    !reviewed ||
                                    !preview.products.length ||
                                    !!preview.errors.length
                                }
                                onClick={async () => {
                                    setError("");
                                    setSaving(true);
                                    try {
                                        if (cloud) {
                                            if (!onSave) throw Error("Reconnect before importing.");
                                            await onSave(preview.products, cloud.revision);
                                            setSavedInput(previewKey);
                                            setData(null);
                                            setMessage("New products saved to your inventory.");
                                        } else {
                                            onImport(preview.products);
                                            setMessage(
                                                "New products added. Your notebook will save them automatically.",
                                            );
                                        }
                                        setReviewed(false);
                                    } catch (e) {
                                        setError(
                                            e instanceof Error
                                                ? e.message
                                                : "Could not save inventory.",
                                        );
                                    } finally {
                                        setSaving(false);
                                    }
                                }}
                            >
                                Add {preview.products.length} products
                            </button>
                        </div>
                    </>
                )}
            </div>
        </CollapsibleCard>
    );
}
