import type { Order } from "./notebook-types";
export type ReportRange = { from: string; to: string; error: string };
export function reportRange(
    period: string,
    today: string,
    dates?: string[],
    from?: string,
    to?: string,
): ReportRange;
export function inReportRange(date: string, range: ReportRange): boolean;
export function revenueBuckets(
    orders: Order[],
    range: ReportRange,
): { from: string; to: string; revenue: number }[];
