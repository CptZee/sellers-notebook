import type { NotebookSnapshot } from "./notebook-types";
import type { parseNotebookView } from "./notebook-view-query.mjs";
export function notebookViewExport(
    document: NotebookSnapshot,
    filters: ReturnType<typeof parseNotebookView>,
    format?: string,
): { body: string; filename: string; type: string };
