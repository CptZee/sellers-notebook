import { eq } from "drizzle-orm";
import { sessionUser, json } from "../../../../lib/api";
import { database } from "../../../../lib/db";
import { notebooks } from "../../../../db/schema";
import { businessReport } from "../../../../lib/server-report";
import { parseReportQuery } from "../../../../lib/report-query.mjs";
import { downloadResponse } from "../../../../lib/saved-notebook";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
    try {
        const user = await sessionUser(request);
        if (!user) return json({ error: "Sign in to export this summary." }, 401);
        let filters;
        try {
            filters = parseReportQuery(new URL(request.url).searchParams);
            if (filters.revision === null) throw Error();
        } catch {
            return json({ error: "Choose valid report filters and a saved revision." }, 400);
        }
        const report = await businessReport(user.id, filters);
        const [metadata] = await database()
            .select({ revision: notebooks.revision, businessName: notebooks.business_name })
            .from(notebooks)
            .where(eq(notebooks.owner_id, user.id));
        if (report.revision !== filters.revision || (metadata?.revision ?? 0) !== filters.revision)
            return json({ error: "The report changed. Export the latest saved version." }, 409);
        const { summary, range, refunds, counts } = report;
        const rows = [
            ["Report", "Business summary"],
            ["Business", metadata?.businessName || user.name || "My business"],
            ["From", range.from],
            ["Through", range.to],
            ["Channel", filters.channel],
            ["Revenue", Number(summary.revenue.toFixed(2))],
            ["Order costs", Number(summary.orderCosts.toFixed(2))],
            ["Order profit", Number(summary.orderProfit.toFixed(2))],
            ["Recorded refunds", refunds],
            ["Revenue after refunds", Number((summary.revenue - refunds).toFixed(2))],
            ["Additional overhead", Number(summary.overhead.toFixed(2))],
            ["Estimated net profit", Number(summary.netProfit.toFixed(2))],
            ["Currency", "PHP"],
            ["Completed order lines", counts.completed],
            [
                "Notes",
                "Excludes taxes, unrecorded costs, and settlement timing. Refunds follow their recorded refund date. Channel views exclude whole-business overhead.",
            ],
        ];
        const csv =
            "\uFEFF" +
            rows
                .map((row) =>
                    row
                        .map(
                            (value) =>
                                '"' +
                                (typeof value === "number"
                                    ? String(value)
                                    : String(value).replace(/^\s*[=+@-]/, "'$&")
                                ).replaceAll('"', '""') +
                                '"',
                        )
                        .join(","),
                )
                .join("\r\n");
        return downloadResponse(
            csv,
            `business-summary-${range.from}-${range.to}.csv`,
            "text/csv;charset=utf-8",
            report.revision,
        );
    } catch {
        return json({ error: "This summary could not be prepared. Please retry." }, 503);
    }
}
