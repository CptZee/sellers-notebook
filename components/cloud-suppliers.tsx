"use client";
import { useEffect, useState, type ReactNode } from "react";
import type { Supplier } from "../lib/notebook-types";
import type { OrderPaging } from "./cloud-orders";
export type SupplierView = {
    items: Supplier[];
    total: number;
    pending: boolean;
    error?: string;
    search: string;
    onSearch: (value: string) => void;
    retry: () => void;
    paging: OrderPaging;
};
type Page = Omit<OrderPaging, "setPage" | "setPageSize"> & { revision: number; items: Supplier[] };
export function CloudSuppliers({
    userId,
    revision,
    renderManager,
}: {
    userId: string;
    revision: number;
    renderManager: (view: SupplierView) => ReactNode;
}) {
    const [search, setSearch] = useState(""),
        [attempt, setAttempt] = useState(0),
        reset = JSON.stringify([userId, search]);
    const [position, setPosition] = useState({ reset: "", page: 1, size: 25 }),
        page = position.reset === reset ? position.page : 1,
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
                search,
                page: String(page),
                size: String(position.size),
            });
        void fetch("/api/notebook/suppliers?" + params, {
            cache: "no-store",
            headers: { "X-Notebook-User": userId },
            signal: controller.signal,
        })
            .then(async (response) => {
                const data = await response.json();
                if (controller.signal.aborted) return;
                if (!response.ok) throw Error(data.error || "Could not load suppliers.");
                if (
                    data.revision !== revision ||
                    !Array.isArray(data.items) ||
                    data.items.length > position.size
                )
                    throw Error("Suppliers changed. Please retry.");
                setState({ key, data });
            })
            .catch((error) => {
                if (!controller.signal.aborted)
                    setState({
                        key,
                        error: error instanceof Error ? error.message : "Could not load suppliers.",
                    });
            });
        return () => controller.abort();
    }, [userId, revision, search, page, position.size, key, attempt]);
    const data = state.key === key ? state.data : undefined,
        error = state.key === key ? state.error : undefined;
    return (
        <>
            {renderManager({
                items: data?.items || [],
                total: data?.total || 0,
                pending: !data,
                error,
                search,
                onSearch: setSearch,
                retry: () => setAttempt((n) => n + 1),
                paging: {
                    page: data?.page || 1,
                    pages: data?.pages || 1,
                    pageSize: position.size,
                    start: data?.start || 0,
                    end: data?.end || 0,
                    total: data?.total || 0,
                    setPage: (page) => setPosition({ reset, page, size: position.size }),
                    setPageSize: (size) => setPosition({ reset, page: 1, size }),
                },
            })}
        </>
    );
}
