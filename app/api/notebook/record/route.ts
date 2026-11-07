import { recordRows, readSavedNotebook } from "../../../../lib/relational-notebook";
import { eq, sql } from "drizzle-orm";
import { database } from "../../../../lib/db";
import { notebooks } from "../../../../db/schema";
import { sessionUser, json, sameOrigin } from "../../../../lib/api";
import {
    parseRecordQuery,
    recordChanges,
    recordCollections,
} from "../../../../lib/notebook-record.mjs";
import { PATCH as patchNotebook } from "../route";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
    try {
        const user = await sessionUser(request);
        if (!user) return json({ error: "Sign in to open this record." }, 401);
        let filters;
        try {
            filters = parseRecordQuery(new URL(request.url).searchParams);
        } catch {
            return json({ error: "Invalid record lookup." }, 400);
        }
        const { collection, id, revision } = filters;
        const result = await database()
            .execute(sql`select coalesce((select revision from ${notebooks} where owner_id=${user.id}),0) revision,
   (select count(*)::int from ${recordRows(user.id, collection)} records) count,
   (select value from ${recordRows(user.id, collection)} records where owner_id=${user.id} and value->>'id'=${id} limit 1) record`);
        const row = result.rows[0];
        if (Number(row.revision) !== revision)
            return json(
                { error: "Records changed. Wait for the latest notebook revision and try again." },
                409,
            );
        if (id && !row.record)
            return json({ error: "This record was removed. Refresh the list." }, 404);
        return json(row);
    } catch {
        return json({ error: "This record is temporarily unavailable. Please retry." }, 503);
    }
}
export async function POST(request: Request) {
    try {
        const user = await sessionUser(request);
        if (!user) return json({ error: "Your session changed. Sign in again." }, 401);
        if (!sameOrigin(request)) return json({ error: "Cross-origin write rejected." }, 403);
        const raw = await request.text(),
            bytes = new TextEncoder().encode(raw).length;
        if (bytes > 768000) return json({ error: "This record is too large." }, 413);
        let input;
        try {
            input = JSON.parse(raw);
        } catch {
            return json({ error: "Invalid record changes." }, 400);
        }
        if (bytes > (input?.collection === "suppliers" ? 768000 : 32000))
            return json({ error: "This record is too large." }, 413);
        if (
            !input ||
            typeof input !== "object" ||
            Array.isArray(input) ||
            !recordCollections.includes(input.collection) ||
            !Number.isSafeInteger(input.revision) ||
            input.revision < 0
        )
            return json({ error: "Invalid record changes." }, 400);
        const saved = await readSavedNotebook(user.id);
        if ((saved?.revision ?? 0) !== input?.revision)
            return json(
                { error: "This notebook changed. Review the latest record and try again." },
                409,
            );
        let changes;
        try {
            changes = recordChanges((saved?.document || {}) as Record<string, unknown>, input);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Invalid record changes.";
            return json({ error: message }, message.startsWith("Invalid") ? 400 : 409);
        }
        // Reuse complete-document validation, owner checks and the atomic revision CAS.
        return patchNotebook(
            new Request(request.url, {
                method: "PATCH",
                headers: request.headers,
                body: JSON.stringify({ revision: input.revision, changes }),
            }),
        );
    } catch {
        return json(
            { error: "This record could not be saved. Keep your entry open and retry." },
            503,
        );
    }
}
