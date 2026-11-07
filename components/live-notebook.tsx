"use client";
import { useCallback, useEffect, useState } from "react";
import {
    createRealtimeClient,
    nodePostgresParsers,
    type SealedLiveQuery,
} from "@neon/realtime/client";
import { RealtimeProvider, useLiveQuery } from "@neon/realtime-react";
type Row = { owner_id: string; revision: number; updated_at: string };
type Props = { userId: string; onRevision: (revision: number) => void };
type Query = { sealedQuery: SealedLiveQuery<Row>; url: string };
export function LiveNotebook(props: Props) {
    const [query, setQuery] = useState<Query | null>(null),
        [error, setError] = useState(""),
        [attempt, setAttempt] = useState(0);
    const refresh = useCallback(async () => {
        const response = await fetch("/api/realtime", {
            cache: "no-store",
            headers: { "X-Notebook-User": props.userId },
        });
        if (response.status === 401) {
            location.assign("/auth/sign-in");
            throw new Error("Session ended.");
        }
        if (!response.ok) throw new Error("Live updates are paused.");
        return response.json() as Promise<Query>;
    }, [props.userId]);
    useEffect(() => {
        let active = true;
        setQuery(null);
        setError("");
        refresh()
            .then((data) => {
                if (active) setQuery(data);
            })
            .catch(() => {
                if (active) setError("Live updates are paused.");
            });
        return () => {
            active = false;
        };
    }, [refresh, attempt]);
    if (error)
        return (
            <div className="live-status">
                {error}
                <button
                    className="text-button"
                    onClick={() => setAttempt((n) => n + 1)}
                >
                    Reconnect
                </button>
            </div>
        );
    if (!query) return <div className="live-status">Connecting your notebook…</div>;
    return (
        <LiveConnection
            key={attempt}
            {...props}
            query={query}
            refresh={refresh}
            retry={() => setAttempt((n) => n + 1)}
        />
    );
}
function LiveConnection({
    query,
    refresh,
    retry,
    ...props
}: Props & { query: Query; refresh: () => Promise<Query>; retry: () => void }) {
    const [client, setClient] = useState<ReturnType<typeof createRealtimeClient> | null>(null);
    const refreshSealed = useCallback(async () => (await refresh()).sealedQuery, [refresh]);
    // Create and dispose the resource in the same effect. Development remounts
    // must create a fresh client instead of reusing one cleanup already closed.
    useEffect(() => {
        const next = createRealtimeClient({ url: query.url, parsers: { ...nodePostgresParsers } });
        setClient(next);
        return () => next.close();
    }, [query.url]);
    if (!client) return <div className="live-status">Connecting live updates…</div>;
    return (
        <RealtimeProvider client={client}>
            <LiveRows
                {...props}
                query={query.sealedQuery}
                refresh={refreshSealed}
                retry={retry}
            />
        </RealtimeProvider>
    );
}
function LiveRows({
    query,
    refresh,
    retry,
    onRevision,
}: Props & {
    query: SealedLiveQuery<Row>;
    refresh: () => Promise<SealedLiveQuery<Row>>;
    retry: () => void;
}) {
    const { data, status } = useLiveQuery(query, { refreshQuery: refresh });
    useEffect(() => {
        if (data?.[0]) onRevision(Number(data[0].revision));
    }, [data, onRevision]);
    return (
        <div className="live-status">
            <span className="live-dot" />
            {status === "live"
                ? "Live across your devices"
                : status === "error"
                  ? "Live updates are paused"
                  : "Connecting live updates…"}
            {status === "error" && (
                <button
                    className="text-button"
                    onClick={retry}
                >
                    Reconnect
                </button>
            )}
        </div>
    );
}
