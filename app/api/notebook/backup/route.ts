import { sessionUser, json } from "../../../../lib/api";
import { savedNotebook, downloadResponse } from "../../../../lib/saved-notebook";
import { createNotebookBackup } from "../../../../lib/notebook-backup.mjs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
    try {
        const user = await sessionUser(request);
        if (!user) return json({ error: "Sign in to download a backup." }, 401);
        const value = new URL(request.url).searchParams.get("revision");
        if (!value || !/^(0|[1-9]\d*)$/.test(value) || !Number.isSafeInteger(Number(value)))
            return json({ error: "Choose a current notebook revision." }, 400);
        const saved = await savedNotebook(user.id);
        if (saved.revision !== Number(value))
            return json(
                { error: "The notebook changed. Wait for its latest version before downloading." },
                409,
            );
        return downloadResponse(
            createNotebookBackup(saved.document),
            `sellers-notebook-backup-${new Date().toISOString().replaceAll(":", "-")}.json`,
            "application/json",
            saved.revision,
        );
    } catch {
        return json({ error: "The backup could not be created. Please retry." }, 503);
    }
}
