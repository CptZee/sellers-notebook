"use client";
import { useEffect, useState } from "react";
import { pageWindow } from "./pagination.mjs";
export function usePagination<T>(items: T[], resetKey = "", initialSize = 25) {
    const [state, setState] = useState({ key: resetKey, page: 1, size: initialSize });
    const window = pageWindow(items.length, state.key === resetKey ? state.page : 1, state.size);
    useEffect(() => {
        setState((previous) =>
            previous.key !== resetKey
                ? { ...previous, key: resetKey, page: 1 }
                : previous.page !== window.page
                  ? { ...previous, page: window.page }
                  : previous,
        );
    }, [resetKey, window.page]);
    return {
        ...window,
        items: items.slice(window.start, window.end),
        setPage: (page: number) => setState({ key: resetKey, page, size: window.pageSize }),
        setPageSize: (size: number) => setState({ key: resetKey, page: 1, size }),
    };
}
