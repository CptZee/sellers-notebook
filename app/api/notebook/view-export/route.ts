import { sessionUser, json } from "../../../../lib/api";
import { savedNotebook, downloadResponse } from "../../../../lib/saved-notebook";
import { parseNotebookView } from "../../../../lib/notebook-view-query.mjs";
import { notebookViewExport } from "../../../../lib/notebook-view-export.mjs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
    try {
        const user = await sessionUser(request);
        if (!user) return json({ error: "Sign in to download these records." }, 401);
        const params = new URL(request.url).searchParams;
        let filters;
        try {
            filters = parseNotebookView(params);
        } catch {
            return json({ error: "Invalid download filters." }, 400);
        }
        const saved = await savedNotebook(user.id);
        if (saved.revision !== filters.revision)
            return json({ error: "Records changed. Wait for the latest notebook revision." }, 409);
        let file;
        try {
            file = notebookViewExport(saved.document, filters, params.get("format") || "csv");
        } catch {
            return json({ error: "Invalid download format." }, 400);
        }
        return downloadResponse(file.body, file.filename, file.type, saved.revision);
    } catch {
        return json({ error: "This download is temporarily unavailable. Please retry." }, 503);
    }
}
