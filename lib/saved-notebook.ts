import { readSavedNotebook } from "./relational-notebook";
import { normalizeBackupDocument } from "./notebook-backup.mjs";
import type { NotebookSnapshot } from "./notebook-types";
export async function savedNotebook(userId: string) {
    const row = await readSavedNotebook(userId);
    return {
        revision: row?.revision ?? 0,
        document: normalizeBackupDocument(
            (row?.document || { products: [], orders: [] }) as NotebookSnapshot,
        ) as NotebookSnapshot,
    };
}
export function downloadResponse(
    body: string,
    filename: string,
    contentType: string,
    revision: number,
) {
    return new Response(body, {
        headers: {
            "Content-Type": contentType,
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Content-Length": String(new TextEncoder().encode(body).length),
            "Cache-Control": "no-store",
            Vary: "Cookie",
            "X-Notebook-Revision": String(revision),
            "X-Content-Type-Options": "nosniff",
        },
    });
}
