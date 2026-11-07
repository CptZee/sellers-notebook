import { readSavedNotebook } from "../../../../lib/relational-notebook";
import { sessionUser, json, sameOrigin } from "../../../../lib/api";
import { stockCommand } from "../../../../lib/stock-command.mjs";
import { PATCH as patchNotebook } from "../route";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
    try {
        const user = await sessionUser(request);
        if (!user) return json({ error: "Your session changed. Sign in again." }, 401);
        if (!sameOrigin(request)) return json({ error: "Cross-origin write rejected." }, 403);
        const raw = await request.text();
        if (new TextEncoder().encode(raw).length > 32000)
            return json({ error: "This stock entry is too large." }, 413);
        let command;
        try {
            command = JSON.parse(raw);
        } catch {
            return json({ error: "Invalid stock command." }, 400);
        }
        if (!command || !Number.isSafeInteger(command.revision) || command.revision < 0)
            return json({ error: "Invalid stock command." }, 400);
        const current = await readSavedNotebook(user.id);
        if ((current?.revision ?? 0) !== command.revision)
            return json({ error: "The notebook changed. Review the latest stock and retry." }, 409);
        let changes;
        try {
            changes = stockCommand((current?.document || {}) as Record<string, any>, command);
        } catch (error) {
            return json(
                { error: error instanceof Error ? error.message : "Invalid stock command." },
                409,
            );
        }
        return patchNotebook(
            new Request(request.url, {
                method: "PATCH",
                headers: request.headers,
                body: JSON.stringify({ revision: command.revision, changes }),
            }),
        );
    } catch {
        return json({ error: "This stock entry could not be saved. Keep it open and retry." }, 503);
    }
}
