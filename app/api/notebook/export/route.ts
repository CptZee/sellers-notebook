import { sessionUser, json } from "../../../../lib/api";
import { savedNotebook, downloadResponse } from "../../../../lib/saved-notebook";
import { notebookExport } from "../../../../lib/notebook-export.mjs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
    try {
        const user = await sessionUser(request);
        if (!user) return json({ error: "Sign in to export your notebook." }, 401);
        const params = new URL(request.url).searchParams,
            value = params.get("revision");
        if (!value || !/^(0|[1-9]\d*)$/.test(value) || !Number.isSafeInteger(Number(value)))
            return json({ error: "Choose a current notebook revision." }, 400);
        const saved = await savedNotebook(user.id);
        if (saved.revision !== Number(value))
            return json(
                { error: "The notebook changed. Wait for its latest version before exporting." },
                409,
            );
        let result;
        try {
            result = notebookExport(saved.document, params);
        } catch {
            return json({ error: "Invalid export filters." }, 400);
        }
        return downloadResponse(
            result.csv,
            result.filename,
            "text/csv;charset=utf-8",
            saved.revision,
        );
    } catch {
        return json({ error: "The export could not be created. Please retry." }, 503);
    }
}
