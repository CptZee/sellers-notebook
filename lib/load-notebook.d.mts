export class NotebookReadError extends Error {
    status: number;
    constructor(message: string, status: number);
}
export type NotebookPageCache = {
    ownerId: string;
    collections: Record<string, { hash: string; items: unknown[] }>;
};
export function loadNotebookPages(options?: {
    fetcher?: typeof fetch;
    cache?: NotebookPageCache | null;
    userId?: string;
    signal?: AbortSignal;
    collections?: string[];
    onProgress?: (completed: number, total: number) => void;
}): Promise<{
    user: { id: string; name: string; email: string; image?: string | null };
    revision: number;
    collections: Record<string, { count: number; hash: string }>;
    document: Record<string, unknown>;
    cache: NotebookPageCache;
    updatedAt: string | null;
}>;
