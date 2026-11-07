export const pageSizes: number[];
export function pageWindow(
    total: number,
    page?: number,
    size?: number,
): { page: number; pageSize: number; pages: number; start: number; end: number; total: number };
