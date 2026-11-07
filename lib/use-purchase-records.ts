"use client";
import { useEffect, useRef, useState } from "react";
import type { CloudNotebook } from "./use-notebook-view";
import type { PurchaseOrder } from "./notebook-types";
export function usePurchaseRecords(
    cloud: CloudNotebook,
    onSave: (command: Record<string, unknown>) => Promise<void>,
) {
    const context = useRef(cloud);
    context.current = cloud;
    const alive = useRef(true),
        cache = useRef<Record<string, { revision: number; record: PurchaseOrder }>>({}),
        [records, setRecords] = useState<typeof cache.current>({}),
        [pending, setPending] = useState(0),
        [error, setError] = useState("");
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
        };
    }, []);
    async function prepare(id?: string) {
        if (!id) return null;
        const owner = context.current.userId,
            revision = context.current.revision;
        setPending((n) => n + 1);
        try {
            const response = await fetch(
                    "/api/notebook/purchase?" +
                        new URLSearchParams({ id, revision: String(revision) }),
                    { cache: "no-store", headers: { "X-Notebook-User": owner } },
                ),
                data = await response.json();
            if (
                !alive.current ||
                context.current.userId !== owner ||
                context.current.revision !== revision
            )
                throw Error("Records changed while opening this purchase. Please retry.");
            if (!response.ok) {
                if (response.status === 404) {
                    const next = { ...cache.current };
                    delete next[id];
                    cache.current = next;
                    setRecords(next);
                }
                throw Error(data.error || "Could not open purchase.");
            }
            cache.current = Object.fromEntries(
                Object.entries({ ...cache.current, [id]: { revision, record: data.record } }).slice(
                    -25,
                ),
            );
            setRecords(cache.current);
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
            return data.record as PurchaseOrder;
        } finally {
            if (alive.current) setPending((n) => n - 1);
        }
    }
    useEffect(() => {
        cache.current = {};
        setRecords({});
        setError("");
    }, [cloud.userId]);
    useEffect(() => {
        const ids = Object.keys(cache.current);
        if (ids.length)
            void Promise.all(ids.map((id) => prepare(id))).catch((error) => {
                if (alive.current)
                    setError(
                        error instanceof Error ? error.message : "Could not refresh purchases.",
                    );
            });
    }, [cloud.revision]);
    async function command(kind: string, id: string, input?: unknown, entryId?: string) {
        const saved = cache.current[id];
        if (!saved || saved.revision !== context.current.revision)
            throw Error("Reopen this purchase to review its latest records.");
        await onSave({
            kind,
            id,
            expected: saved.record,
            ...(input === undefined ? {} : { input }),
            ...(entryId ? { entryId } : {}),
        });
    }
    const outdated = Object.values(records).some((record) => record.revision !== cloud.revision);
    return {
        orders: Object.values(records).map((value) => value.record),
        prepare,
        command,
        error,
        setError,
        pending: pending > 0 || outdated,
        get: (id: string) => cache.current[id]?.record,
    };
}
