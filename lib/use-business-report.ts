"use client";
import { useEffect, useState } from "react";
import type { BusinessReport } from "./server-report";
export function useBusinessReport({
    enabled,
    userId,
    revision,
    period,
    channel,
    from,
    to,
}: {
    enabled: boolean;
    userId?: string;
    revision: number;
    period: string;
    channel: string;
    from: string;
    to: string;
}) {
    const key = JSON.stringify([userId, revision, period, channel, from, to]);
    const [state, setState] = useState<{ key: string; data?: BusinessReport; error?: string }>({
            key: "",
        }),
        [attempt, setAttempt] = useState(0);
    useEffect(() => {
        if (!enabled || !userId) return;
        const controller = new AbortController();
        const params = new URLSearchParams({
            revision: String(revision),
            period,
            channel,
            from,
            to,
        });
        void fetch("/api/notebook/report?" + params, {
            cache: "no-store",
            headers: { "X-Notebook-User": userId },
            signal: controller.signal,
        })
            .then(async (response) => {
                const data = await response.json();
                if (controller.signal.aborted) return;
                if (!response.ok) throw Error(data.error || "Could not load this report.");
                if (data.revision !== revision)
                    throw Error(
                        "Wait for the latest notebook revision before viewing this report.",
                    );
                setState({ key, data });
            })
            .catch((error) => {
                if (!controller.signal.aborted)
                    setState({
                        key,
                        error:
                            error instanceof Error ? error.message : "Could not load this report.",
                    });
            });
        return () => controller.abort();
    }, [enabled, userId, revision, period, channel, from, to, key, attempt]);
    return {
        data: enabled && state.key === key ? state.data : undefined,
        error: enabled && state.key === key ? state.error : undefined,
        retry: () => {
            setState({ key: "" });
            setAttempt((n) => n + 1);
        },
    };
}
