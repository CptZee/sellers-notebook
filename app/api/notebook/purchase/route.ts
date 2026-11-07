import { recordRows, readSavedNotebook } from "../../../../lib/relational-notebook";
import { eq, sql } from "drizzle-orm";
import { database } from "../../../../lib/db";
import { notebooks } from "../../../../db/schema";
import { sessionUser, json, sameOrigin } from "../../../../lib/api";
import { purchaseCommand } from "../../../../lib/purchase-command.mjs";
import type { NotebookSnapshot } from "../../../../lib/notebook-types";
import { PATCH as patchNotebook } from "../route";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
    try {
        const user = await sessionUser(request);
        if (!user) return json({ error: "Sign in to open this purchase." }, 401);
        const params = new URL(request.url).searchParams,
            id = params.get("id"),
            revision = params.get("revision");
        if (
            !id ||
            id.length > 100 ||
            !revision ||
            !/^(0|[1-9]\d*)$/.test(revision) ||
            !Number.isSafeInteger(Number(revision))
        )
            return json({ error: "Invalid purchase lookup." }, 400);
        const result = await database().execute(
                sql`select coalesce((select revision from ${notebooks} where owner_id=${user.id}),0) revision,(select value from ${recordRows(user.id, "purchaseOrders")} records where owner_id=${user.id} and value->>'id'=${id} limit 1) record`,
            ),
            row = result.rows[0];
        if (Number(row.revision) !== Number(revision))
            return json(
                { error: "Records changed. Wait for the latest notebook revision and retry." },
                409,
            );
        return row.record
            ? json(row)
            : json({ error: "This purchase was removed. Refresh the list." }, 404);
    } catch {
        return json({ error: "This purchase is temporarily unavailable. Please retry." }, 503);
    }
}
export async function POST(request: Request) {
    try {
        const user = await sessionUser(request);
        if (!user) return json({ error: "Your session changed. Sign in again." }, 401);
        if (!sameOrigin(request)) return json({ error: "Cross-origin write rejected." }, 403);
        const raw = await request.text();
        if (new TextEncoder().encode(raw).length > 4000000)
            return json({ error: "This purchase entry is too large." }, 413);
        let command;
        try {
            command = JSON.parse(raw);
        } catch {
            return json({ error: "Invalid purchase command." }, 400);
        }
        if (!command || !Number.isSafeInteger(command.revision) || command.revision < 0)
            return json({ error: "Invalid purchase command." }, 400);
        const current = await readSavedNotebook(user.id);
        if ((current?.revision ?? 0) !== command.revision)
            return json(
                { error: "The notebook changed. Review the latest purchase and retry." },
                409,
            );
        let changes;
        try {
            changes = purchaseCommand(
                (current?.document || {}) as Partial<NotebookSnapshot>,
                command,
            );
        } catch (error) {
            return json(
                { error: error instanceof Error ? error.message : "Invalid purchase command." },
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
        return json(
            { error: "This purchase entry could not be saved. Keep it open and retry." },
            503,
        );
    }
}
