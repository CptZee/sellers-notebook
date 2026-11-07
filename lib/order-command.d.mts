import type { NotebookSnapshot } from "./notebook-types";
export function orderCommand(
    document: Partial<NotebookSnapshot>,
    command: unknown,
    today?: string,
): Record<string, unknown>;
