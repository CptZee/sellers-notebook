import type { NotebookSnapshot } from "./notebook-types";
export function purchaseCommand(
    document: Partial<NotebookSnapshot>,
    command: unknown,
): Record<string, unknown>;
