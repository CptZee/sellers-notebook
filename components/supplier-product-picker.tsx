"use client";
import { useEffect, useState } from "react";
import type { CloudNotebook } from "../lib/use-notebook-view";
import type { Product } from "../lib/notebook-types";
import { Pagination } from "./pagination";
type Page = {
    revision: number;
    items: { product: Product }[];
    page: number;
    pages: number;
    pageSize: number;
    start: number;
    end: number;
    total: number;
};
export function SupplierProductPicker({
    cloud,
    selected,
    onChange,
}: {
    cloud: CloudNotebook;
    selected: string[];
    onChange: (ids: string[]) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    return (
        <details
            className="supplier-products"
            onToggle={(event) => setExpanded(event.currentTarget.open)}
        >
            <summary>Linked inventory items · {selected.length} selected</summary>
            {expanded && (
                <ProductOptions
                    cloud={cloud}
                    selected={selected}
                    onChange={onChange}
                />
            )}
        </details>
    );
}
function ProductOptions({
    cloud,
    selected,
    onChange,
}: Parameters<typeof SupplierProductPicker>[0]) {
    const [search, setSearch] = useState(""),
        [page, setPage] = useState(1),
        [size, setSize] = useState(25),
        [attempt, setAttempt] = useState(0),
        key = JSON.stringify([cloud.userId, cloud.revision, search, page, size]),
        [state, setState] = useState<{ key: string; data?: Page; error?: string }>({ key: "" }),
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
                if (!response.ok) throw Error(data.error || "Could not load inventory items.");
                if (!controller.signal.aborted) setState({ key, data });
            })
            .catch((error) => {
                if (!controller.signal.aborted)
                    setState({
                        key,
                        error:
                            error instanceof Error
                                ? error.message
                                : "Could not load inventory items.",
                    });
            });
        return () => controller.abort();
    }, [key, attempt]);
    return (
        <>
            <label className="field">
                <span>Find products to link</span>
                <input
                    aria-label="Find products to link"
                    maxLength={200}
                    value={search}
                    onChange={(event) => {
                        setSearch(event.target.value);
                        setPage(1);
                    }}
                />
            </label>
            <p className="import-note">
                Selections are kept across pages and searches. Only checked product links are saved;
                stock stays unchanged.
            </p>
            {!data ? (
                <p
                    className="import-note"
                    role="status"
                >
                    {(state.key === key && state.error) || "Finding inventory items…"}
                    {state.key === key && state.error && (
                        <button
                            className="text-button"
                            type="button"
                            onClick={() => setAttempt((n) => n + 1)}
                        >
                            Retry product links
                        </button>
                    )}
                </p>
            ) : (
                <>
                    <div className="supplier-product-options">
                        {data.items.map(({ product }) => (
                            <label key={product.id}>
                                <input
                                    type="checkbox"
                                    checked={selected.includes(product.id)}
                                    onChange={(event) =>
                                        onChange(
                                            event.target.checked
                                                ? [...selected, product.id]
                                                : selected.filter((id) => id !== product.id),
                                        )
                                    }
                                />
                                <span>
                                    {product.name}
                                    <small>{product.sku}</small>
                                </span>
                            </label>
                        ))}
                    </div>
                    <Pagination
                        label="Supplier products"
                        {...data}
                        setPage={setPage}
                        setPageSize={(size) => {
                            setSize(size);
                            setPage(1);
                        }}
                    />
                    {!data.total && (
                        <p className="import-note">
                            {search
                                ? "No products match this search."
                                : "Add inventory products first, then link them here."}
                        </p>
                    )}
                </>
            )}
        </>
    );
}
