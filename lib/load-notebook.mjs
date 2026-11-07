import { notebookCollections, notebookPageSize } from "./notebook-pages.mjs";
export class NotebookReadError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
    }
}
// Cache lives in the hook, never in browser persistence or a shared module.
export async function loadNotebookPages({
    fetcher = fetch,
    cache = null,
    userId,
    signal,
    collections,
    onProgress = () => {},
} = {}) {
    for (let attempt = 0; attempt < 3; attempt++) {
        const controller = new AbortController(),
            abort = () => controller.abort();
        if (signal?.aborted) controller.abort();
        else signal?.addEventListener("abort", abort, { once: true });
        const headers = userId ? { "X-Notebook-User": userId } : {};
        const read = async (url) => {
            controller.signal.throwIfAborted();
            const response = await fetcher(url, {
                cache: "no-store",
                headers: { ...headers },
                signal: controller.signal,
            });
            const data = await response.json();
            controller.signal.throwIfAborted();
            if (!response.ok)
                throw new NotebookReadError(
                    data.error || "Could not open your notebook.",
                    response.status,
                );
            return data;
        };
        try {
            const manifest = await read("/api/notebook/manifest");
            if (
                !manifest.user?.id ||
                (userId && manifest.user.id !== userId) ||
                !Number.isSafeInteger(manifest.revision) ||
                manifest.revision < 0
            )
                throw Error("Invalid notebook manifest.");
            // Bind every subsequent page to this identity, including the first load.
            headers["X-Notebook-User"] = manifest.user.id;
            const keys = Object.keys(notebookCollections),
                document = {
                    sidebarNote: manifest.metadata?.sidebarNote || "",
                    branding: manifest.metadata?.branding || null,
                },
                nextCache = { ownerId: manifest.user.id, collections: {} },
                tasks = [];
            let completed = 0,
                total = 0;
            for (const key of keys) {
                const info = manifest.collections?.[key];
                if (
                    !info ||
                    !Number.isSafeInteger(info.count) ||
                    info.count < 0 ||
                    info.count > notebookCollections[key] ||
                    typeof info.hash !== "string" ||
                    !info.hash
                )
                    throw Error("Invalid notebook collection manifest.");
                const old = cache?.ownerId === manifest.user.id ? cache.collections[key] : null;
                if (collections && !collections.includes(key)) {
                    document[key] = [];
                    if (old?.hash === info.hash && old.items.length === info.count)
                        nextCache.collections[key] = old;
                    continue;
                }
                if (old?.hash === info.hash && old.items.length === info.count)
                    document[key] = old.items;
                else {
                    document[key] = new Array(info.count);
                    total += info.count;
                    for (let offset = 0; offset < info.count; offset += notebookPageSize)
                        tasks.push({
                            key,
                            offset,
                            count: Math.min(notebookPageSize, info.count - offset),
                        });
                }
                nextCache.collections[key] = { hash: info.hash, items: document[key] };
            }
            onProgress(0, total);
            let index = 0;
            const worker = async () => {
                while (index < tasks.length) {
                    const { key, offset, count } = tasks[index++],
                        params = new URLSearchParams({
                            collection: key,
                            revision: String(manifest.revision),
                            offset: String(offset),
                            limit: String(count),
                        });
                    const page = await read("/api/notebook/pages?" + params);
                    if (
                        page.collection !== key ||
                        page.revision !== manifest.revision ||
                        page.offset !== offset ||
                        !Array.isArray(page.items) ||
                        page.items.length !== count
                    )
                        throw Error("An incomplete notebook page was received. Please retry.");
                    document[key].splice(offset, count, ...page.items);
                    completed += count;
                    onProgress(completed, total);
                }
            };
            await Promise.all(Array.from({ length: Math.min(4, tasks.length) }, worker));
            return { ...manifest, document, cache: nextCache };
        } catch (error) {
            controller.abort();
            if (
                error instanceof NotebookReadError &&
                error.status === 409 &&
                attempt < 2 &&
                !signal?.aborted
            )
                continue;
            throw error;
        } finally {
            signal?.removeEventListener("abort", abort);
        }
    }
    throw Error("The notebook keeps changing. Please retry opening it.");
}
