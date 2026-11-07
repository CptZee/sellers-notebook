export function canonicalJson(value: unknown): string;
export function createNotebookPatch(
    before: Record<string, any>,
    after: Record<string, any>,
): Record<string, unknown>;
export function applyNotebookPatch(
    document: Record<string, any>,
    changes: unknown,
): Record<string, any>;
