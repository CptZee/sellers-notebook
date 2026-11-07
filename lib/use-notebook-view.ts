"use client";
import { useEffect, useState } from "react";
import type { OrderPaging } from "../components/cloud-orders";
export type CloudNotebook = {
    userId: string;
    revision: number;
    hydrated?: boolean;
    blocked?: boolean;
    counts?: Record<string, number>;
};
type Data<T> = Omit<OrderPaging, "setPage" | "setPageSize"> & {
    revision: number;
    items: T[];
    totals: Record<string, number>;
    counts: Record<string, number>;
    options: { id: string; name: string; archived?: boolean }[];
};
export function useNotebookView<T>(
    cloud: CloudNotebook | undefined,
    kind: string,
    filters: Record<string, string>,
    enabled = true,
) {
    const reset = JSON.stringify([cloud?.userId, kind, filters]),
        [position, setPosition] = useState({ reset: "", page: 1, size: 25 }),
        [attempt, setAttempt] = useState(0),
        page = position.reset === reset ? position.page : 1;
    const viewKey = JSON.stringify([reset, page, position.size]),
        key = JSON.stringify([reset, cloud?.revision, page, position.size]),
        [state, setState] = useState<{
            key: string;
            viewKey?: string;
            data?: Data<T>;
            error?: string;
        }>({ key: "" });
    useEffect(() => {
        setPosition((previous) =>
            previous.reset === reset ? previous : { ...previous, reset, page: 1 },
        );
    }, [reset]);
    useEffect(() => {
        if (!cloud || !enabled || cloud.blocked) return;
        const controller = new AbortController(),
            params = new URLSearchParams({
                kind,
                revision: String(cloud.revision),
                page: String(page),
                size: String(position.size),
                ...filters,
            });
        void fetch("/api/notebook/view?" + params, {
            cache: "no-store",
            headers: { "X-Notebook-User": cloud.userId },
            signal: controller.signal,
        })
            .then(async (response) => {
                const data = await response.json();
                if (controller.signal.aborted) return;
                if (!response.ok) throw Error(data.error || "Could not load these records.");
                if (
                    data.revision !== cloud.revision ||
                    !Array.isArray(data.items) ||
                    data.items.length > position.size
                )
                    throw Error("Records changed. Please retry.");
                setState({ key, viewKey, data });
            })
            .catch((error) => {
                if (!controller.signal.aborted)
                    setState((previous) => ({
                        key,
                        viewKey,
                        data: previous.viewKey === viewKey ? previous.data : undefined,
                        error:
                            error instanceof Error
                                ? error.message
                                : "Could not load these records.",
                    }));
            });
        return () => controller.abort();
    }, [
        cloud?.userId,
        cloud?.revision,
        kind,
        reset,
        key,
        page,
        position.size,
        enabled,
        cloud?.blocked,
        attempt,
    ]);
    const data = state.viewKey === viewKey ? state.data : undefined;
    useEffect(() => {
        if (data && data.page !== page)
            setPosition((previous) => ({ ...previous, page: data.page }));
    }, [data?.page, page]);
    return {
        items: data?.items || [],
        total: data?.total || 0,
        totals: data?.totals || {},
        counts: data?.counts || {},
        options: data?.options || [],
        pending: !!cloud && (!data || state.key !== key || !!state.error || !!cloud.blocked),
        error: state.key === key ? state.error : undefined,
        retry: () => setAttempt((n) => n + 1),
        paging: {
            page: data?.page || 1,
            pages: data?.pages || 1,
            pageSize: position.size,
            start: data?.start || 0,
            end: data?.end || 0,
            total: data?.total || 0,
            setPage: (page: number) => setPosition({ reset, page, size: position.size }),
            setPageSize: (size: number) => setPosition({ reset, page: 1, size }),
        },
    };
}
