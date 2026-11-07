"use client";
import { useEffect, useState, type ReactNode } from "react";
import type { Expense } from "../lib/notebook-types";
import type { OrderPaging } from "./cloud-orders";
export type ExpenseView = {
    items: Expense[];
    total: number;
    totalAmount: number;
    pending: boolean;
    error?: string;
    search: string;
    category: string;
    onSearch: (value: string) => void;
    onCategory: (value: string) => void;
    retry: () => void;
    paging: OrderPaging;
};
type Page = Omit<OrderPaging, "setPage" | "setPageSize"> & {
    revision: number;
    items: Expense[];
    totalAmount: number;
};
export function CloudExpenses({
    userId,
    revision,
    period,
    channel,
    from,
    to,
    renderLedger,
}: {
    userId: string;
    revision: number;
    period: string;
    channel: string;
    from: string;
    to: string;
    renderLedger: (view: ExpenseView) => ReactNode;
}) {
    const [search, setSearch] = useState(""),
        [category, setCategory] = useState("All categories"),
        [attempt, setAttempt] = useState(0);
    const reset = JSON.stringify([userId, period, channel, from, to, search, category]),
        [position, setPosition] = useState({ reset: "", page: 1, size: 25 });
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
                category,
                page: String(page),
                size: String(position.size),
            });
        void fetch("/api/notebook/expenses?" + params, {
            cache: "no-store",
            headers: { "X-Notebook-User": userId },
            signal: controller.signal,
        })
            .then(async (response) => {
                const data = await response.json();
                if (controller.signal.aborted) return;
                if (!response.ok) throw Error(data.error || "Could not load expenses.");
                if (
                    data.revision !== revision ||
                    !Array.isArray(data.items) ||
                    data.items.length > position.size ||
                    !Number.isFinite(data.totalAmount)
                )
                    throw Error("Expenses changed. Please retry.");
                setState({ key, data });
            })
            .catch((error) => {
                if (!controller.signal.aborted)
                    setState({
                        key,
                        error: error instanceof Error ? error.message : "Could not load expenses.",
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
        category,
        page,
        position.size,
        key,
        attempt,
    ]);
    const data = state.key === key ? state.data : undefined,
        error = state.key === key ? state.error : undefined;
    return (
        <>
            {renderLedger({
                items: data?.items || [],
                total: data?.total || 0,
                totalAmount: data?.totalAmount || 0,
                pending: !data,
                error,
                search,
                category,
                onSearch: setSearch,
                onCategory: setCategory,
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
