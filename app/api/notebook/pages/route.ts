import { eq, sql } from "drizzle-orm";
import { database } from "../../../../lib/db";
import { notebooks } from "../../../../db/schema";
import { sessionUser, json } from "../../../../lib/api";
import { parseNotebookPage } from "../../../../lib/notebook-pages.mjs";
import { recordRows } from "../../../../lib/relational-notebook";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
    try {
        const user = await sessionUser(request);
        if (!user) return json({ error: "Sign in to open your notebook." }, 401);
        let page;
        try {
            page = parseNotebookPage(new URL(request.url).searchParams);
        } catch {
            return json({ error: "Invalid notebook page." }, 400);
        }
        const { collection, revision, offset, limit } = page;
        const [row] = await database()
            .select({
                revision: notebooks.revision,
                items: sql<
                    unknown[]
                >`coalesce((select jsonb_agg(entry.value order by entry.ordinality) from (select value,ordinality from ${recordRows(user.id, collection)} records order by ordinality offset ${offset} limit ${limit}) entry),'[]'::jsonb)`,
            })
            .from(notebooks)
            .where(eq(notebooks.owner_id, user.id));
        if ((row?.revision ?? 0) !== revision)
            return json(
                { error: "The notebook changed while loading. Restart from its current version." },
                409,
            );
        return json({ collection, revision, offset, items: row?.items ?? [] });
    } catch {
        return json(
            { error: "This notebook page is temporarily unavailable. Please try again." },
            503,
        );
    }
}
