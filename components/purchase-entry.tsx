"use client";
import { useEffect, useState } from "react";
import type { CloudNotebook } from "../lib/use-notebook-view";
import type { Product, Supplier } from "../lib/notebook-types";
import { EntryModal } from "./entry-modal";
import { Pagination } from "./pagination";
type Paging = {
    page: number;
    pages: number;
    pageSize: number;
    start: number;
    end: number;
    total: number;
};
function useChoices<T>(
    cloud: CloudNotebook,
    path: string,
    filters: Record<string, string>,
    enabled = true,
) {
    const [page, setPage] = useState(1),
        [size, setSize] = useState(25),
        [attempt, setAttempt] = useState(0),
        reset = JSON.stringify(filters),
        key = JSON.stringify([cloud.userId, cloud.revision, reset, page, size]),
        [state, setState] = useState<{
            key: string;
            data?: Paging & { items: T[] };
            error?: string;
        }>({ key: "" });
    useEffect(() => setPage(1), [reset]);
    useEffect(() => {
        if (!enabled) return;
        const controller = new AbortController();
        void fetch(
            path +
                "?" +
                new URLSearchParams({
                    revision: String(cloud.revision),
                    page: String(page),
                    size: String(size),
                    ...filters,
                }),
            {
                cache: "no-store",
                headers: { "X-Notebook-User": cloud.userId },
                signal: controller.signal,
            },
        )
            .then(async (response) => {
                const data = await response.json();
                if (!response.ok) throw Error(data.error || "Could not load choices.");
                if (!controller.signal.aborted) setState({ key, data });
            })
            .catch((error) => {
                if (!controller.signal.aborted)
                    setState({
                        key,
                        error: error instanceof Error ? error.message : "Could not load choices.",
                    });
            });
        return () => controller.abort();
    }, [key, attempt, enabled]);
    const data = state.key === key ? state.data : undefined;
    return {
        data,
        error: state.key === key ? state.error : undefined,
        retry: () => setAttempt((n) => n + 1),
        paging: data
            ? {
                  ...data,
                  setPage,
                  setPageSize: (size: number) => {
                      setSize(size);
                      setPage(1);
                  },
              }
            : null,
    };
}
export type PurchaseSeed = {
    revision: number;
    supplier: Supplier;
    products: Product[];
    lines: { productId: string; quantity: number; unitCost: number }[];
};
export function PurchaseEntry({
    cloud,
    onSave,
    onClose,
    disabled,
    seed,
}: {
    seed?: PurchaseSeed;
    cloud: CloudNotebook;
    onSave: (command: Record<string, unknown>) => Promise<void>;
    onClose: () => void;
    disabled: boolean;
}) {
    const [supplierSearch, setSupplierSearch] = useState(""),
        [productSearch, setProductSearch] = useState(""),
        [supplier, setSupplier] = useState<Supplier | null>(seed?.supplier || null),
        [lines, setLines] = useState<{ product: Product; quantity: number; unitCost: number }[]>(
            () =>
                seed?.lines.map((line) => ({
                    product: seed.products.find((p) => p.id === line.productId)!,
                    quantity: line.quantity,
                    unitCost: line.unitCost,
                })) || [],
        ),
        [error, setError] = useState(""),
        [submitting, setSubmitting] = useState(false),
        [id] = useState(() => crypto.randomUUID());
    const suppliers = useChoices<Supplier>(cloud, "/api/notebook/suppliers", {
            search: supplierSearch,
        }),
        products = useChoices<{ product: Product }>(
            cloud,
            "/api/notebook/inventory",
            { search: productSearch, supplierId: supplier?.id || "" },
            !!supplier,
        );
    return (
        <EntryModal
            title="New purchase order"
            description="Choose a supplier and the items you plan to order."
            onClose={onClose}
        >
            <form
                className="purchase-form"
                onSubmit={async (event) => {
                    event.preventDefault();
                    if (!supplier || submitting) return;
                    const form = new FormData(event.currentTarget);
                    setError("");
                    setSubmitting(true);
                    try {
                        if (seed && seed.revision !== cloud.revision)
                            throw Error(
                                "The notebook changed. Close this draft and prepare a fresh restock plan.",
                            );
                        await onSave({
                            kind: "create",
                            id,
                            expected: supplier,
                            input: {
                                lines: lines.map((line) => ({
                                    productId: line.product.id,
                                    quantity: line.quantity,
                                    unitCost: line.unitCost,
                                })),
                                notes: String(form.get("notes") || ""),
                                expectedDate: String(form.get("expectedDate") || ""),
                            },
                        });
                        onClose();
                    } catch (e) {
                        setError(e instanceof Error ? e.message : "Could not create purchase.");
                    } finally {
                        setSubmitting(false);
                    }
                }}
            >
                <fieldset disabled={disabled || submitting}>
                    <div className="supplier-fields">
                        <label className="field">
                            <span>Find a supplier</span>
                            <input
                                aria-label="Find a purchase supplier"
                                value={supplierSearch}
                                maxLength={200}
                                onChange={(event) => setSupplierSearch(event.target.value)}
                            />
                        </label>
                        <label className="field">
                            <span>Purchase supplier</span>
                            <select
                                aria-label="Purchase supplier"
                                required
                                value={supplier?.id || ""}
                                onChange={(event) => {
                                    setSupplier(
                                        suppliers.data?.items.find(
                                            (s) => s.id === event.target.value,
                                        ) || null,
                                    );
                                    setLines([]);
                                    setProductSearch("");
                                    setError("");
                                }}
                            >
                                <option value="">Choose supplier</option>
                                {supplier &&
                                    !suppliers.data?.items.some((s) => s.id === supplier.id) && (
                                        <option value={supplier.id}>
                                            {supplier.name} (selected)
                                        </option>
                                    )}
                                {suppliers.data?.items.map((s) => (
                                    <option
                                        key={s.id}
                                        value={s.id}
                                    >
                                        {s.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="field">
                            <span>Expected delivery (optional)</span>
                            <input
                                name="expectedDate"
                                type="date"
                            />
                        </label>
                    </div>
                    {suppliers.paging ? (
                        <Pagination
                            label="Purchase suppliers"
                            {...suppliers.paging}
                        />
                    ) : (
                        <p
                            className="import-note"
                            role="status"
                        >
                            {suppliers.error || "Finding suppliers…"}
                            {suppliers.error && (
                                <button
                                    className="text-button"
                                    type="button"
                                    onClick={suppliers.retry}
                                >
                                    Retry suppliers
                                </button>
                            )}
                        </p>
                    )}
                    {supplier && (
                        <>
                            <label className="field">
                                <span>Find linked inventory</span>
                                <input
                                    aria-label="Find a purchase product"
                                    value={productSearch}
                                    maxLength={200}
                                    onChange={(event) => setProductSearch(event.target.value)}
                                />
                            </label>
                            {products.paging ? (
                                <>
                                    <div className="supplier-product-options">
                                        {products.data?.items.map(({ product }) => (
                                            <button
                                                className="button secondary"
                                                type="button"
                                                key={product.id}
                                                disabled={
                                                    lines.some(
                                                        (line) => line.product.id === product.id,
                                                    ) || lines.length >= 100
                                                }
                                                onClick={() =>
                                                    setLines((old) => [
                                                        ...old,
                                                        {
                                                            product,
                                                            quantity: 1,
                                                            unitCost: product.cost,
                                                        },
                                                    ])
                                                }
                                            >
                                                Add {product.name} · {product.sku}
                                            </button>
                                        ))}
                                    </div>
                                    <Pagination
                                        label="Purchase products"
                                        {...products.paging}
                                    />
                                    {!products.data?.total && (
                                        <p className="import-note">
                                            No matching linked products. Link inventory items in the
                                            supplier editor first.
                                        </p>
                                    )}
                                </>
                            ) : (
                                <p
                                    className="import-note"
                                    role="status"
                                >
                                    {products.error || "Finding linked products…"}
                                    {products.error && (
                                        <button
                                            className="text-button"
                                            type="button"
                                            onClick={products.retry}
                                        >
                                            Retry purchase products
                                        </button>
                                    )}
                                </p>
                            )}
                        </>
                    )}
                    {lines.map((line, index) => (
                        <div
                            className="purchase-line"
                            key={line.product.id}
                        >
                            <div>
                                <strong>{line.product.name}</strong>
                                <small>{line.product.sku}</small>
                            </div>
                            <label className="field">
                                <span>Units {index + 1}</span>
                                <input
                                    aria-label={`Purchase units ${index + 1}`}
                                    type="number"
                                    min="1"
                                    max="10000000"
                                    step="1"
                                    required
                                    value={line.quantity}
                                    onChange={(event) =>
                                        setLines((old) =>
                                            old.map((row, i) =>
                                                i === index
                                                    ? {
                                                          ...row,
                                                          quantity: Number(event.target.value),
                                                      }
                                                    : row,
                                            ),
                                        )
                                    }
                                />
                            </label>
                            <label className="field">
                                <span>Unit cost (₱) {index + 1}</span>
                                <input
                                    aria-label={`Purchase unit cost ${index + 1}`}
                                    type="number"
                                    min="0"
                                    max="100000000"
                                    step="0.01"
                                    required
                                    value={line.unitCost}
                                    onChange={(event) =>
                                        setLines((old) =>
                                            old.map((row, i) =>
                                                i === index
                                                    ? {
                                                          ...row,
                                                          unitCost: Number(event.target.value),
                                                      }
                                                    : row,
                                            ),
                                        )
                                    }
                                />
                            </label>
                            <button
                                type="button"
                                className="text-button cancel"
                                aria-label={`Remove purchase line ${index + 1}`}
                                onClick={() => setLines((old) => old.filter((_, i) => i !== index))}
                            >
                                Remove
                            </button>
                        </div>
                    ))}
                    <label className="field purchase-notes">
                        <span>Purchase notes</span>
                        <textarea
                            name="notes"
                            aria-label="Purchase notes"
                            maxLength={1000}
                            rows={2}
                        />
                    </label>
                    <p className="import-note">
                        This records a purchase arranged outside the notebook. Stock increases only
                        when you record an arrival.
                    </p>
                    {error && (
                        <p
                            className="auth-error"
                            role="alert"
                        >
                            {error}
                        </p>
                    )}
                    <div className="supplier-actions">
                        <button
                            type="button"
                            className="button secondary"
                            onClick={onClose}
                        >
                            Cancel purchase entry
                        </button>
                        <button
                            className="button primary"
                            disabled={!supplier || !lines.length}
                        >
                            Save purchase order
                        </button>
                    </div>
                </fieldset>
            </form>
        </EntryModal>
    );
}
