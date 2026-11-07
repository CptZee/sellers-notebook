import { sessionUser, json } from "../../../../lib/api";
import { parseReportQuery } from "../../../../lib/report-query.mjs";
import { businessReport } from "../../../../lib/server-report";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
    try {
        const user = await sessionUser(request);
        if (!user) return json({ error: "Sign in to view your report." }, 401);
        let filters;
        try {
            filters = parseReportQuery(new URL(request.url).searchParams);
        } catch {
            return json({ error: "Choose a valid reporting period, dates and channel." }, 400);
        }
        const report = await businessReport(user.id, filters);
        if (filters.revision !== null && report.revision !== filters.revision)
            return json(
                { error: "The report changed. Wait for the latest notebook revision." },
                409,
            );
        return json(report);
    } catch {
        return json({ error: "Your report is temporarily unavailable. Please retry." }, 503);
    }
}
