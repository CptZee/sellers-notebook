"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { CollapsibleCard } from "./collapsible-card";
import type { Order } from "../lib/notebook-types";
export type OrderPaging = {
    page: number;
    pages: number;
    pageSize: number;
    start: number;
    end: number;
    total: number;
    setPage: (page: number) => void;
    setPageSize: (size: number) => void;
};
type Page = Omit<OrderPaging, "setPage" | "setPageSize"> & { revision: number; items: Order[] };
export function CloudOrders({
    userId,
    revision,
    period,
    channel,
    from,
    to,
    search,
    status,
    sort,
    onSearch,
    onStatus,
    onSort,
    onImport,
    disabled,
    renderTable,
}: {
    userId: string;
    revision: number;
    period: string;
    channel: string;
    from: string;
    to: string;
    search: string;
    status: string;
    sort: string;
    onSearch: (value: string) => void;
    onStatus: (value: string) => void;
    onSort: (value: string) => void;
    onImport: () => void;
    disabled: boolean;
    renderTable: (orders: Order[], paging: OrderPaging, key: string) => ReactNode;
}) {
    const reset = JSON.stringify([userId, period, channel, from, to, search, status, sort]),
        [position, setPosition] = useState({ reset: "", page: 1, size: 25 }),
        [attempt, setAttempt] = useState(0);
    const page = position.reset === reset ? position.page : 1,
        key = JSON.stringify([reset, revision, page, position.size]);
    const [state, setState] = useState<{ key: string; data?: Page; error?: string }>({ key: "" });
    useEffect(() => {
        setPosition((previous) =>
            previous.reset === reset ? previous : { ...previous, reset, page: 1 },
        );
    }, [reset]);
    useEffect(() => {
        const controller = new AbortController(),
            params = new URLSearchParams({
                revision: String(revision),
                period,
                channel,
                from,
                to,
                search,
                status,
                sort,
                page: String(page),
                size: String(position.size),
            });
        void fetch("/api/notebook/orders?" + params, {
            cache: "no-store",
            headers: { "X-Notebook-User": userId },
            signal: controller.signal,
        })
            .then(async (response) => {
                const data = await response.json();
                if (controller.signal.aborted) return;
                if (!response.ok) throw Error(data.error || "Could not load orders.");
                if (
                    data.revision !== revision ||
                    !Array.isArray(data.items) ||
                    data.items.length > position.size
                )
                    throw Error("Orders changed. Please retry.");
                setState({ key, data });
            })
            .catch((error) => {
                if (!controller.signal.aborted)
                    setState({
                        key,
                        error: error instanceof Error ? error.message : "Could not load orders.",
                    });
            });
        return () => controller.abort();
    }, [
        userId,
        revision,
        period,
        channel,
        from,
        to,
        search,
        status,
        sort,
        page,
        position.size,
        key,
        attempt,
    ]);
    const data = state.key === key ? state.data : undefined,
        error = state.key === key ? state.error : undefined;
    return (
        <CollapsibleCard
            className="cloud-orders"
            title="All orders"
            description="Manual sales reserve stock. Imported history preserves current stock."
            actions={
                <div className="order-tools">
                    <button
                        className="button secondary"
                        disabled={disabled}
                        onClick={onImport}
                    >
                        Import orders CSV
                    </button>
                    <label className="search">
                        <Search size={17} />
                        <input
                            aria-label="Search orders"
                            maxLength={200}
                            placeholder="Customer, order ID, SKU…"
                            value={search}
                            onChange={(event) => onSearch(event.target.value)}
                        />
                    </label>
                </div>
            }
        >
            <div className="order-list-controls">
                <label className="field">
                    <span>Order status</span>
                    <select
                        aria-label="Order status filter"
                        value={status}
                        onChange={(event) => onStatus(event.target.value)}
                    >
                        {["All statuses", "Processing", "Completed", "Cancelled"].map((value) => (
                            <option key={value}>{value}</option>
                        ))}
                    </select>
                </label>
                <label className="field">
                    <span>Sort orders</span>
                    <select
                        aria-label="Sort orders"
                        value={sort}
                        onChange={(event) => onSort(event.target.value)}
                    >
                        <option value="newest">Newest first</option>
                        <option value="oldest">Oldest first</option>
                        <option value="value">Highest value</option>
                    </select>
                </label>
                <small>
                    {data?.total ?? "…"} order lines shown · filters apply to the list and order
                    export
                </small>
            </div>
            {!data ? (
                <div
                    className="empty"
                    role="status"
                >
                    {error || "Opening orders…"}
                    {error && (
                        <button
                            className="text-button"
                            onClick={() => setAttempt((n) => n + 1)}
                        >
                            Retry orders
                        </button>
                    )}
                </div>
            ) : (
                renderTable(
                    data.items,
                    {
                        ...data,
                        setPage: (page) => setPosition({ reset, page, size: position.size }),
                        setPageSize: (size) => setPosition({ reset, page: 1, size }),
                    },
                    key,
                )
            )}
        </CollapsibleCard>
    );
}
