import { eq, sql } from "drizzle-orm";
import { database } from "../../../../lib/db";
import { notebooks } from "../../../../db/schema";
import { sessionUser, json } from "../../../../lib/api";
import { notebookCollections } from "../../../../lib/notebook-pages.mjs";
import { recordRows } from "../../../../lib/relational-notebook";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
    try {
        const user = await sessionUser(request);
        if (!user) return json({ error: "Sign in to open your notebook." }, 401);
        const entries = Object.keys(notebookCollections).flatMap((key) => [
            sql`${key}::text`,
            sql`(select jsonb_build_object('count',count(*),'hash',md5(coalesce(jsonb_agg(value order by ordinality),'[]'::jsonb)::text)) from ${recordRows(user.id, key)} records)`,
        ]);
        const [row] = await database()
            .select({
                revision: notebooks.revision,
                updatedAt: notebooks.updated_at,
                metadata: sql`jsonb_build_object('sidebarNote',${notebooks.sidebar_note},'branding',case when ${notebooks.business_name} is null then null else jsonb_build_object('businessName',${notebooks.business_name},'notebookTitle',${notebooks.notebook_title},'tagline',${notebooks.tagline},'icon',${notebooks.icon}) end)`,
                collections: sql`jsonb_build_object(${sql.join(entries, sql`, `)})`,
            })
            .from(notebooks)
            .where(eq(notebooks.owner_id, user.id));
        return json({
            user,
            revision: row?.revision ?? 0,
            updatedAt: row?.updatedAt ?? null,
            metadata: row?.metadata ?? { sidebarNote: "", branding: null },
            collections:
                row?.collections ??
                Object.fromEntries(
                    Object.keys(notebookCollections).map((key) => [
                        key,
                        { count: 0, hash: "empty" },
                    ]),
                ),
        });
    } catch {
        return json({ error: "Your notebook is temporarily unavailable. Please try again." }, 503);
    }
}
