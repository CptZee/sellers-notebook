export const reportChannels: string[];
export function parseReportQuery(
    params: URLSearchParams,
    today?: string,
): {
    period: string;
    channel: string;
    today: string;
    range: { from: string; to: string; error: string };
    revision: number | null;
};
