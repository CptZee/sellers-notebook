export function parseOrdersQuery(
    params: URLSearchParams,
    today?: string,
): {
    page: number;
    size: number;
    revision: number;
    search: string;
    period: string;
    channel: string;
    today: string;
    range: { from: string; to: string; error: string };
    status: string;
    sort: string;
};
