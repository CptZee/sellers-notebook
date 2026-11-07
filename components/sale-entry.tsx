"use client";
import { useEffect, useState } from "react";
import type { CloudNotebook } from "../lib/use-notebook-view";
import type { Product } from "../lib/notebook-types";
import { EntryModal } from "./entry-modal";
import { Pagination } from "./pagination";
type Products = {
    revision: number;
    items: { product: Product }[];
    page: number;
    pages: number;
    pageSize: number;
    start: number;
    end: number;
    total: number;
};
export function SaleEntry({
    cloud,
    onSave,
    onClose,
    disabled,
}: {
    cloud: CloudNotebook;
    onSave: (command: Record<string, unknown>) => Promise<void>;
    onClose: () => void;
    disabled: boolean;
}) {
    const [search, setSearch] = useState(""),
        [page, setPage] = useState(1),
        [size, setSize] = useState(25),
        [attempt, setAttempt] = useState(0),
        [selected, setSelected] = useState<Product | null>(null),
        [error, setError] = useState(""),
        [submitting, setSubmitting] = useState(false),
        [id] = useState(() => crypto.randomUUID());
    const key = JSON.stringify([cloud.userId, cloud.revision, search, page, size]),
        [state, setState] = useState<{ key: string; data?: Products; error?: string }>({ key: "" }),
        data = state.key === key ? state.data : undefined;
    useEffect(() => {
        const controller = new AbortController();
        void fetch(
            "/api/notebook/inventory?" +
                new URLSearchParams({
                    revision: String(cloud.revision),
                    search,
                    page: String(page),
                    size: String(size),
                }),
            {
                cache: "no-store",
                headers: { "X-Notebook-User": cloud.userId },
                signal: controller.signal,
            },
        )
            .then(async (response) => {
                const data = await response.json();
                if (!response.ok) throw Error(data.error || "Could not load products.");
                if (!controller.signal.aborted) setState({ key, data });
            })
            .catch((error) => {
                if (!controller.signal.aborted)
                    setState({
                        key,
                        error: error instanceof Error ? error.message : "Could not load products.",
                    });
            });
        return () => controller.abort();
    }, [key, attempt]);
    useEffect(() => {
        if (data && !selected) {
            const first = data.items.find((item) => item.product.stock > 0);
            if (first) setSelected(first.product);
        }
    }, [data, selected]);
    const available = data?.items.filter((item) => item.product.stock > 0) || [];
    return (
        <EntryModal
            title="Record a sale"
            description="A little win for your business."
            onClose={onClose}
        >
            <form
                className="product-sale-form"
                onSubmit={async (event) => {
                    event.preventDefault();
                    if (submitting || disabled || !selected) return;
                    const form = new FormData(event.currentTarget);
                    setError("");
                    setSubmitting(true);
                    try {
                        await onSave({
                            kind: "sale",
                            id,
                            expected: selected,
                            input: {
                                customer: String(form.get("customer") || ""),
                                quantity: Number(form.get("quantity")),
                                channel: String(form.get("channel")),
                                fee: Number(form.get("fee")),
                                packaging: Number(form.get("packaging")),
                                shipping: Number(form.get("shipping")),
                                date: String(form.get("date")),
                            },
                        });
                        onClose();
                    } catch (e) {
                        setError(e instanceof Error ? e.message : "Could not record this sale.");
                    } finally {
                        setSubmitting(false);
                    }
                }}
            >
                <fieldset disabled={disabled || submitting}>
                    <div className="form-grid">
                        <label className="field">
                            <span>Customer name</span>
                            <input
                                name="customer"
                                required
                                maxLength={200}
                                autoFocus
                            />
                        </label>
                        <label className="field">
                            <span>Find an inventory product</span>
                            <input
                                aria-label="Find a sale product"
                                placeholder="Product name or SKU"
                                value={search}
                                maxLength={200}
                                onChange={(event) => {
                                    setSearch(event.target.value);
                                    setPage(1);
                                }}
                            />
                        </label>
                        <label className="field">
                            <span>Product</span>
                            <select
                                aria-label="Product"
                                name="product"
                                required
                                value={selected?.id || ""}
                                onChange={(event) => {
                                    setSelected(
                                        data?.items.find(
                                            (item) => item.product.id === event.target.value,
                                        )?.product || null,
                                    );
                                    setError("");
                                }}
                            >
                                <option value="">Choose a product</option>
                                {selected &&
                                    !available.some((item) => item.product.id === selected.id) && (
                                        <option value={selected.id}>
                                            {selected.name} · {selected.stock} available (selected)
                                        </option>
                                    )}
                                {available.map(({ product }) => (
                                    <option
                                        key={product.id}
                                        value={product.id}
                                    >
                                        {product.name} · {product.stock} available
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="field">
                            <span>Sales channel</span>
                            <select
                                aria-label="Sales channel"
                                name="channel"
                            >
                                {["Shopee", "Lazada", "TikTok Shop", "Direct"].map((channel) => (
                                    <option key={channel}>{channel}</option>
                                ))}
                            </select>
                        </label>
                        <label className="field">
                            <span>Quantity</span>
                            <input
                                name="quantity"
                                type="number"
                                min="1"
                                max={selected?.stock || 0}
                                required
                                defaultValue="1"
                            />
                        </label>
                        <label className="field">
                            <span>Platform fee (%)</span>
                            <input
                                name="fee"
                                type="number"
                                min="0"
                                max="99.99"
                                step="0.01"
                                required
                                defaultValue="8"
                            />
                        </label>
                        <label className="field">
                            <span>Packaging per order (₱)</span>
                            <input
                                name="packaging"
                                type="number"
                                min="0"
                                step="0.01"
                                required
                                defaultValue="15"
                            />
                        </label>
                        <label className="field">
                            <span>Shipping you cover (₱)</span>
                            <input
                                name="shipping"
                                type="number"
                                min="0"
                                step="0.01"
                                required
                                defaultValue="0"
                            />
                        </label>
                        <label className="field">
                            <span>Order date</span>
                            <input
                                name="date"
                                type="date"
                                required
                                defaultValue={new Date().toLocaleDateString("en-CA", {
                                    timeZone: "Asia/Manila",
                                })}
                            />
                        </label>
                    </div>
                    {!data ? (
                        <p
                            className="import-note"
                            role="status"
                        >
                            {(state.key === key && state.error) || "Finding products…"}
                            {state.key === key && state.error && (
                                <button
                                    className="text-button"
                                    type="button"
                                    onClick={() => setAttempt((n) => n + 1)}
                                >
                                    Retry products
                                </button>
                            )}
                        </p>
                    ) : (
                        <Pagination
                            label="Sale products"
                            {...data}
                            setPage={setPage}
                            setPageSize={(size) => {
                                setSize(size);
                                setPage(1);
                            }}
                        />
                    )}
                    <p className="form-hint">
                        Orders start as Processing and reserve stock when saved. Only products with
                        available stock can be selected. Search and pagination cover your inventory;
                        the selected product stays selected across pages.
                    </p>
                    {error && (
                        <p
                            className="form-error"
                            role="alert"
                        >
                            {error}
                            {error.includes("product changed") && (
                                <button
                                    className="text-button"
                                    type="button"
                                    onClick={() => {
                                        setSelected(null);
                                        setState({ key: "" });
                                        setAttempt((n) => n + 1);
                                    }}
                                >
                                    Review latest stock
                                </button>
                            )}
                        </p>
                    )}
                    <div className="modal-actions">
                        <button
                            className="button secondary"
                            type="button"
                            onClick={onClose}
                        >
                            Cancel
                        </button>
                        <button
                            className="button primary"
                            type="submit"
                            disabled={!selected || !data}
                        >
                            Record sale
                        </button>
                    </div>
                </fieldset>
            </form>
        </EntryModal>
    );
}
