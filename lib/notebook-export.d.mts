import type { NotebookSnapshot } from "./notebook-types";
export function notebookExport(
    document: NotebookSnapshot,
    params: URLSearchParams,
    today?: string,
): { filename: string; csv: string };
