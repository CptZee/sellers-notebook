export function parseInventoryQuery(params: URLSearchParams): {
    page: number;
    size: number;
    revision: number;
    search: string;
};
