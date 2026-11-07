"use client";
import type { CloudNotebook } from "../lib/use-notebook-view";
import { CollapsibleCard } from "./collapsible-card";
import { Pagination } from "./pagination";
import { usePagination } from "../lib/use-pagination";
import { useEffect, useState } from "react";
import { Upload, X, Check, Download } from "lucide-react";
import {
    importFields,
    readShopeeCsv,
    previewShopeeImport,
    type ImportOptions,
    type ImportPreview,
    type Mapping,
} from "../lib/shopee-import.mjs";
import type { Product, Order } from "../lib/notebook-types";

export function ShopeeImport({
    products,
    orders,
    onImport,
    onClose,
    disabled,
    fetched,
    cloud,
    onSave,
}: {
    cloud?: CloudNotebook;
    onSave?: (payload: Record<string, unknown>, revision: number) => Promise<void>;
    products: Product[];
    orders: Order[];
    onImport: (orders: Order[]) => void;
    onClose: () => void;
    disabled: boolean;
    fetched?: {
        platform?: "Shopee" | "Lazada" | "TikTok Shop";
        shopId: string;
        rows: Record<string, string>[];
    } | null;
}) {
    const [platform, setPlatform] = useState<"Shopee" | "Lazada" | "TikTok Shop">("Shopee");
    const [file, setFile] = useState(""),
        [headers, setHeaders] = useState<string[]>([]),
        [rows, setRows] = useState<Record<string, string>[]>([]),
        [mapping, setMapping] = useState<Mapping>({}),
        [preview, setPreview] = useState<ImportPreview | null>(null),
        [busy, setBusy] = useState(false),
        [error, setError] = useState(""),
        [done, setDone] = useState(""),
        [reviewed, setReviewed] = useState(false);
    const [options, setOptions] = useState<ImportOptions>({
        fee: 0,
        packaging: 0,
        shipping: 0,
        dateFormat: "ISO",
    });
    useEffect(() => {
        if (!fetched?.rows.length) return;
        setPlatform(fetched.platform || "Shopee");
        const headings = Object.keys(fetched.rows[0]);
        setHeaders(headings);
        setRows(fetched.rows);
        setMapping(
            Object.fromEntries(
                importFields.map((field) => [
                    field.key,
                    headings.find((header) => field.aliases.includes(header.toLowerCase())) || "",
                ]),
            ),
        );
        setFile(`${fetched.platform || "Shopee"} shop ${fetched.shopId}`);
        setDone("");
        setError("");
        setOptions((previous) => ({ ...previous, dateFormat: "ISO" }));
    }, [fetched]);
    const [saving, setSaving] = useState(false),
        [attempt, setAttempt] = useState(0),
        [labels, setLabels] = useState<{ id: string; sku: string }[]>([]);
    const previewKey = JSON.stringify([
            cloud?.userId,
            cloud?.revision,
            rows,
            mapping,
            options,
            platform,
        ]),
        [preparedKey, setPreparedKey] = useState("");
    useEffect(() => {
        if (!rows.length) return;
        const controller = new AbortController();
        let active = true;
        setBusy(true);
        setReviewed(false);
        setPreview(null);
        setError("");
        const timer = setTimeout(() => {
            const task = cloud
                ? fetch("/api/notebook/marketplace-import", {
                      method: "POST",
                      headers: {
                          "Content-Type": "application/json",
                          "X-Notebook-User": cloud.userId,
                      },
                      body: JSON.stringify({
                          mode: "preview",
                          revision: cloud.revision,
                          rows,
                          mapping,
                          options,
                          platform,
                      }),
                      signal: controller.signal,
                  }).then(async (response) => {
                      const result = await response.json();
                      if (!response.ok)
                          throw Error(result.error || "Could not prepare marketplace preview.");
                      if (active) setLabels(result.products);
                      return result as ImportPreview;
                  })
                : previewShopeeImport(rows, mapping, products, orders, options, platform);
            void task
                .then((result) => {
                    if (active) {
                        setPreview(result);
                        setPreparedKey(previewKey);
                    }
                })
                .catch((e) => {
                    if (active) setError(e.message || "Could not prepare these rows.");
                })
                .finally(() => {
                    if (active) setBusy(false);
                });
        }, 250);
        return () => {
            active = false;
            controller.abort();
            clearTimeout(timer);
        };
    }, [previewKey, products, orders, attempt]);
    const paging = usePagination(
        preview?.orders || [],
        file + "|" + platform + "|" + JSON.stringify(mapping) + "|" + JSON.stringify(options),
        10,
    );
    async function choose(e: React.ChangeEvent<HTMLInputElement>) {
        setError("");
        setDone("");
        setPreview(null);
        const chosen = e.target.files?.[0];
        if (!chosen) return;
        try {
            if (chosen.size > 2 * 1024 * 1024) throw new Error("Use a CSV smaller than 2 MB.");
            const data = readShopeeCsv(await chosen.text());
            setHeaders(data.headers);
            setMapping(data.mapping);
            setRows(data.rows);
            setFile(chosen.name);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not read this file.");
            setRows([]);
        } finally {
            e.target.value = "";
        }
    }
    function template() {
        const csv =
            "Order ID,Seller SKU,Quantity,Unit Price,Order Date,Order Status,Buyer Username,Currency\r\nSAMPLE-001,YOUR-SKU,1,299.00,2026-11-05,Completed,Sample buyer,PHP\r\n";
        const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = platform.toLowerCase().replaceAll(" ", "-") + "-import-template.csv";
        a.click();
        URL.revokeObjectURL(url);
    }
    return (
        <CollapsibleCard
            className="import-card"
            title={<>A page from your {platform} shop</>}
            description={
                <> Upload a CSV, match its columns, and review every order line before saving. </>
            }
            actions={
                <>
                    {" "}
                    <button
                        className="icon-button"
                        aria-label="Close importer"
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
                    <label className="field">
                        <span>Marketplace for CSV</span>
                        <select
                            aria-label="Marketplace for CSV"
                            value={platform}
                            disabled={!!fetched || saving}
                            onChange={(e) => {
                                setPlatform(e.target.value as typeof platform);
                                setFile("");
                                setRows([]);
                                setHeaders([]);
                                setMapping({});
                                setPreview(null);
                                setError("");
                                setDone("");
                                setReviewed(false);
                            }}
                        >
                            {["Shopee", "Lazada", "TikTok Shop"].map((name) => (
                                <option key={name}>{name}</option>
                            ))}
                        </select>
                    </label>
                    <label className="button secondary upload-button">
                        <Upload size={16} />
                        Choose {platform} CSV
                        <input
                            type="file"
                            accept=".csv,text/csv"
                            aria-label={`Choose ${platform} CSV`}
                            disabled={saving}
                            onChange={choose}
                        />
                    </label>
                    <button
                        className="text-button"
                        onClick={template}
                    >
                        <Download size={14} />
                        Example template
                    </button>
                    {file && (
                        <small>
                            {file} · {rows.length} lines
                        </small>
                    )}
                </div>
                <p className="import-note">
                    Match Seller SKUs to products already in Inventory. This imports order history
                    without changing current stock. Use CSV rather than Excel files; the template is
                    an example, not a guaranteed marketplace export format.
                </p>
                {error && (
                    <p
                        className="auth-error"
                        role="alert"
                    >
                        {error}
                        {cloud && rows.length > 0 && !preview && (
                            <button
                                className="text-button"
                                onClick={() => setAttempt((n) => n + 1)}
                            >
                                Retry marketplace preview
                            </button>
                        )}
                    </p>
                )}
                {done && (
                    <p
                        className="auth-message"
                        role="status"
                    >
                        <Check size={15} />
                        {done}
                    </p>
                )}
                {rows.length > 0 && (
                    <>
                        <div className="import-mapping">
                            {importFields.map((field) => (
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
                                        value={mapping[field.key] || ""}
                                        onChange={(e) =>
                                            setMapping({ ...mapping, [field.key]: e.target.value })
                                        }
                                    >
                                        <option value="">
                                            {field.required ? "Select a column" : "Not included"}
                                        </option>
                                        {headers.map((header) => (
                                            <option
                                                key={header}
                                                value={header}
                                            >
                                                {header}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            ))}
                        </div>
                        <div className="import-defaults">
                            <label className="field">
                                <span>Date format</span>
                                <select
                                    disabled={saving}
                                    value={options.dateFormat}
                                    onChange={(e) =>
                                        setOptions({
                                            ...options,
                                            dateFormat: e.target
                                                .value as ImportOptions["dateFormat"],
                                        })
                                    }
                                >
                                    <option value="ISO">Year-month-day</option>
                                    <option value="DMY">Day/month/year</option>
                                    <option value="MDY">Month/day/year</option>
                                </select>
                            </label>
                            {(
                                [
                                    { key: "fee", label: "Platform fee (%)" },
                                    { key: "packaging", label: "Packaging per order (₱)" },
                                    { key: "shipping", label: "Shipping you cover per order (₱)" },
                                ] as const
                            ).map((field) => (
                                <label
                                    className="field"
                                    key={field.key}
                                >
                                    <span>{field.label}</span>
                                    <input
                                        type="number"
                                        disabled={saving}
                                        min="0"
                                        step="0.01"
                                        max={field.key === "fee" ? 99.99 : 100000000}
                                        value={options[field.key]}
                                        onChange={(e) =>
                                            setOptions({
                                                ...options,
                                                [field.key]: Number(e.target.value),
                                            })
                                        }
                                    />
                                </label>
                            ))}
                        </div>
                        <p className="import-note">
                            Enter your actual fee and cost defaults. Estimates use each product’s
                            current unit cost; packaging and shipping are counted once per{" "}
                            {platform} order. Zero defaults mean no recorded fees or fulfillment
                            costs. Delivered orders remain Processing until marked Completed.
                            Refunds and returns are not imported.
                        </p>
                        {preview && (
                            <>
                                <div className="import-summary">
                                    <strong>{preview.orders.length} new lines</strong>
                                    <span>{preview.duplicates} already imported</span>
                                    <span>{preview.errors.length} issues</span>
                                </div>
                                {preview.errors.length > 0 && (
                                    <div
                                        className="import-errors"
                                        role="alert"
                                    >
                                        <strong>Fix these issues before importing:</strong>
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
                                                <th>{platform} order</th>
                                                <th>Product / SKU</th>
                                                <th>Qty</th>
                                                <th>Unit price</th>
                                                <th>Status</th>
                                                <th>Date</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paging.items.map((order) => (
                                                <tr key={order.id}>
                                                    <td>{order.sourceOrderId}</td>
                                                    <td>
                                                        {order.productName}
                                                        <small>
                                                            {
                                                                (cloud ? labels : products).find(
                                                                    (p) => p.id === order.productId,
                                                                )?.sku
                                                            }
                                                        </small>
                                                    </td>
                                                    <td>{order.quantity}</td>
                                                    <td>₱{order.price.toFixed(2)}</td>
                                                    <td>{order.status}</td>
                                                    <td>{order.date}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <Pagination
                                    label="Order preview"
                                    {...paging}
                                />
                                <label className="import-confirm">
                                    <input
                                        type="checkbox"
                                        disabled={saving}
                                        checked={reviewed && preparedKey === previewKey}
                                        onChange={(e) => setReviewed(e.target.checked)}
                                    />
                                    I’ve reviewed the prices and cost defaults. Keep current stock
                                    unchanged.
                                </label>
                                <div className="import-actions">
                                    <small>
                                        {disabled
                                            ? "Wait until current changes finish saving."
                                            : busy
                                              ? "Preparing the preview…"
                                              : "Duplicates are skipped; existing orders are not overwritten."}
                                    </small>
                                    <button
                                        className="button primary"
                                        disabled={
                                            disabled ||
                                            saving ||
                                            busy ||
                                            preparedKey !== previewKey ||
                                            !reviewed ||
                                            !preview.orders.length ||
                                            !!preview.errors.length
                                        }
                                        onClick={async () => {
                                            setSaving(true);
                                            setError("");
                                            try {
                                                if (cloud) {
                                                    if (!onSave)
                                                        throw Error("Reconnect before importing.");
                                                    await onSave(
                                                        { rows, mapping, options, platform },
                                                        cloud.revision,
                                                    );
                                                    setRows([]);
                                                    setPreview(null);
                                                    setReviewed(false);
                                                    setDone(
                                                        `${preview.orders.length} order lines saved.`,
                                                    );
                                                } else {
                                                    onImport(preview.orders);
                                                    setDone(
                                                        `${preview.orders.length} order lines added. Your notebook will save them automatically.`,
                                                    );
                                                }
                                            } catch (e) {
                                                setError(
                                                    e instanceof Error
                                                        ? e.message
                                                        : "Could not save marketplace orders.",
                                                );
                                            } finally {
                                                setSaving(false);
                                            }
                                        }}
                                    >
                                        Add {preview.orders.length} order lines
                                    </button>
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>
        </CollapsibleCard>
    );
}
