export const pageSizes = [10, 25, 50, 100];
export function pageWindow(total, page = 1, size = 25) {
    const pageSize = pageSizes.includes(size) ? size : 25,
        count = Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0;
    const pages = Math.max(1, Math.ceil(count / pageSize)),
        current = Math.min(pages, Math.max(1, Math.floor(Number.isFinite(page) ? page : 1)));
    return {
        page: current,
        pageSize,
        pages,
        start: (current - 1) * pageSize,
        end: Math.min(current * pageSize, count),
        total: count,
    };
}
