"use client";
import { useEffect, useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import { CollapsibleCard } from "./collapsible-card";
import { Pagination } from "./pagination";
import { stockTargets } from "../lib/restock-plan.mjs";
import type { Product } from "../lib/notebook-types";
type Page = {
    revision: number;
    page: number;
    pages: number;
    pageSize: number;
    start: number;
    end: number;
    total: number;
    items: { product: Product; suppliers: { id: string; name: string }[] }[];
};
const money = (value: number) =>
    new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
export function CloudInventory({
    userId,
    revision,
    search,
    onSearch,
    onEdit,
    onFiles,
    onImport,
    disabled,
}: {
    userId: string;
    revision: number;
    search: string;
    onSearch: (value: string) => void;
    onEdit: (product: Product) => void;
    onFiles: (id: string) => void;
    onImport: () => void;
    disabled: boolean;
}) {
    const [position, setPosition] = useState({ search: "", page: 1, size: 25 }),
        [attempt, setAttempt] = useState(0);
    const page = position.search === search ? position.page : 1,
        key = JSON.stringify([userId, revision, search, page, position.size]);
    const [state, setState] = useState<{ key: string; data?: Page; error?: string }>({ key: "" });
    useEffect(() => {
        const controller = new AbortController(),
            params = new URLSearchParams({
                revision: String(revision),
                search,
                page: String(page),
                size: String(position.size),
            });
        void fetch("/api/notebook/inventory?" + params, {
            cache: "no-store",
            headers: { "X-Notebook-User": userId },
            signal: controller.signal,
        })
            .then(async (response) => {
                const data = await response.json();
                if (controller.signal.aborted) return;
                if (!response.ok) throw Error(data.error || "Could not load inventory.");
                if (
                    data.revision !== revision ||
                    !Array.isArray(data.items) ||
                    data.items.length > position.size
                )
                    throw Error("Inventory changed. Please retry.");
                setState({ key, data });
            })
            .catch((error) => {
                if (!controller.signal.aborted)
                    setState({
                        key,
                        error: error instanceof Error ? error.message : "Could not load inventory.",
                    });
            });
        return () => controller.abort();
    }, [userId, revision, search, page, position.size, key, attempt]);
    const data = state.key === key ? state.data : undefined,
        error = state.key === key ? state.error : undefined;
    return (
        <CollapsibleCard
            className="inventory-card"
            title="Product collection"
            description="Click a product to edit or restock it."
            actions={
                <div className="order-tools">
                    <button
                        className="button secondary"
                        disabled={disabled}
                        onClick={onImport}
                    >
                        Import inventory CSV
                    </button>
                    <label className="search">
                        <Search size={17} />
                        <input
                            placeholder="Search products…"
                            maxLength={200}
                            value={search}
                            onChange={(event) => {
                                setPosition({
                                    search: event.target.value,
                                    page: 1,
                                    size: position.size,
                                });
                                onSearch(event.target.value);
                            }}
                        />
                    </label>
                </div>
            }
        >
            {!data ? (
                <div
                    className="empty"
                    role="status"
                >
                    {error || "Opening products…"}
                    {error && (
                        <button
                            className="text-button"
                            onClick={() => setAttempt((n) => n + 1)}
                        >
                            Retry inventory
                        </button>
                    )}
                </div>
            ) : (
                <>
                    <div className="table-scroll">
                        <table>
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>Category</th>
                                    <th>Unit cost</th>
                                    <th>Selling price</th>
                                    <th>Stock</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {data.items.map(({ product: p, suppliers }) => (
                                    <tr key={p.id}>
                                        <td>
                                            <div className="product-cell">
                                                <span
                                                    className="product-thumb"
                                                    style={{ background: p.color }}
                                                    aria-hidden="true"
                                                >
                                                    {p.symbol}
                                                </span>
                                                <div>
                                                    <strong>{p.name}</strong>
                                                    <small>{p.sku}</small>
                                                    {suppliers.length > 0 && (
                                                        <small>
                                                            Supplier:{" "}
                                                            {suppliers
                                                                .map((supplier) => supplier.name)
                                                                .join(", ")}
                                                        </small>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td>{p.category}</td>
                                        <td>{money(p.cost)}</td>
                                        <td className="amount">{money(p.price)}</td>
                                        <td>
                                            <span
                                                className={
                                                    p.stock <= stockTargets(p).reorderPoint
                                                        ? "stock-pill"
                                                        : "status completed"
                                                }
                                            >
                                                {p.stock} in stock
                                            </span>
                                            <small>
                                                Alert at {stockTargets(p).reorderPoint} · Target{" "}
                                                {stockTargets(p).targetStock}
                                            </small>
                                        </td>
                                        <td>
                                            <div className="row-actions">
                                                <button
                                                    className="text-button"
                                                    disabled={disabled}
                                                    onClick={() => onEdit(p)}
                                                >
                                                    Edit
                                                    <ArrowUpRight size={14} />
                                                </button>
                                                <button
                                                    className="text-button"
                                                    disabled={disabled}
                                                    aria-label={`Files for ${p.name}`}
                                                    onClick={() => onFiles(p.id)}
                                                >
                                                    Files
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {!data.items.length && (
                            <p className="empty">No products found. Try a different search.</p>
                        )}
                    </div>
                    <Pagination
                        label="Inventory"
                        {...data}
                        setPage={(page) => setPosition({ search, page, size: position.size })}
                        setPageSize={(size) => setPosition({ search, page: 1, size })}
                    />
                </>
            )}
        </CollapsibleCard>
    );
}
