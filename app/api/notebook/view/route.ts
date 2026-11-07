import { sessionUser, json } from "../../../../lib/api";
import { parseNotebookView } from "../../../../lib/notebook-view-query.mjs";
import { notebookView } from "../../../../lib/server-notebook-view";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
    try {
        const user = await sessionUser(request);
        if (!user) return json({ error: "Sign in to view these records." }, 401);
        let filters;
        try {
            filters = parseNotebookView(new URL(request.url).searchParams);
        } catch {
            return json({ error: "Invalid list filters." }, 400);
        }
        const result = await notebookView(user.id, filters);
        return result.stale
            ? json({ error: "Records changed. Wait for the latest notebook revision." }, 409)
            : json(result.data);
    } catch {
        return json({ error: "These records are temporarily unavailable. Please retry." }, 503);
    }
}
