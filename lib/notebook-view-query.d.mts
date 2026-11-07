export const viewKinds: string[];
export function parseNotebookView(
    params: URLSearchParams,
    today?: string,
): {
    page: number;
    size: number;
    revision: number;
    search: string;
    kind: string;
    supplierId: string;
    parent: string;
    id: string;
    status: string;
    today: string;
    financial: string;
};
