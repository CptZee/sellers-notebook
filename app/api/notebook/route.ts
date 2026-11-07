import { sessionUser, json, sameOrigin } from "../../../lib/api";
import { validDocument } from "../../../lib/notebook-validation.mjs";
import { applyNotebookPatch, createNotebookPatch } from "../../../lib/notebook-patch.mjs";
import { normalizeBackupDocument } from "../../../lib/notebook-backup.mjs";
import { readSavedNotebook, commitNotebookChanges } from "../../../lib/relational-notebook";
export const dynamic = "force-dynamic";
const conflict = () =>
    json(
        {
            error: "This notebook changed on another device. Reload its saved version before editing again.",
        },
        409,
    );
export async function GET(request: Request) {
    try {
        const user = await sessionUser(request);
        if (!user) return json({ error: "Sign in to open your notebook." }, 401);
        return json({ user, ...(await readSavedNotebook(user.id)) });
    } catch {
        return json({ error: "Your notebook is temporarily unavailable. Please try again." }, 503);
    }
}
async function save(request: Request, patch: boolean) {
    const user = await sessionUser(request);
    if (!user) return json({ error: "Your session changed. Sign in again." }, 401);
    if (!sameOrigin(request)) return json({ error: "Cross-origin write rejected." }, 403);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 4000000)
        return json({ error: "Notebook is too large." }, 413);
    let body;
    try {
        body = JSON.parse(raw);
    } catch {
        return json({ error: "Invalid JSON." }, 400);
    }
    if (
        !body ||
        !Number.isSafeInteger(body.revision) ||
        body.revision < 0 ||
        Object.keys(body).some((key) => !["revision", patch ? "changes" : "document"].includes(key))
    )
        return json({ error: "Invalid notebook changes." }, 400);
    const current = await readSavedNotebook(user.id);
    if (current.revision !== body.revision) return conflict();
    let document;
    try {
        document = patch
            ? applyNotebookPatch(current.document, body.changes)
            : normalizeBackupDocument(body.document);
    } catch {
        return json({ error: "Invalid record changes." }, 400);
    }
    if (!validDocument(document))
        return json(
            { error: "These record changes would invalidate notebook data or linked records." },
            400,
        );
    if (new TextEncoder().encode(JSON.stringify(document)).length > 4000000)
        return json({ error: "Notebook is too large." }, 413);
    const changes = createNotebookPatch(current.document, document);
    if (!Object.keys(changes).length && request.headers.get("X-Notebook-Restore") === "true")
        return json({ revision: current.revision, updatedAt: current.updatedAt, txid: null });
    const saved = await commitNotebookChanges(user.id, user.name, body.revision, changes);
    return saved ? json(saved) : conflict();
}
export async function PUT(request: Request) {
    try {
        return await save(request, false);
    } catch {
        return json(
            {
                error: "Your changes could not be saved right now. Keep this page open and retry saving.",
            },
            503,
        );
    }
}
export async function PATCH(request: Request) {
    try {
        return await save(request, true);
    } catch {
        return json(
            {
                error: "Your changes could not be saved right now. Keep this page open and retry saving.",
            },
            503,
        );
    }
}
