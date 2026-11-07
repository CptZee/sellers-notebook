import { sessionUser, json, sameOrigin } from "../../../../lib/api";
import { withAccountUpload } from "../../../../lib/account-lifecycle";
import { database } from "../../../../lib/db";
import { notebooks } from "../../../../db/schema";
import { eq } from "drizzle-orm";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
    const user = await sessionUser(request);
    if (!user) return json({ error: "Sign in to open your tutorial." }, 401);
    try {
        const [row] = await database()
            .select({ completedAt: notebooks.tour_completed_at })
            .from(notebooks)
            .where(eq(notebooks.owner_id, user.id));
        return json({ completed: !!row?.completedAt });
    } catch {
        return json({ error: "Could not load your tutorial. Please retry." }, 503);
    }
}
export async function POST(request: Request) {
    const user = await sessionUser(request);
    if (!user) return json({ error: "Sign in to save your tutorial." }, 401);
    if (!sameOrigin(request)) return json({ error: "Cross-origin request rejected." }, 403);
    try {
        const raw = await request.text();
        if (raw.length > 100) throw Error();
        const body = JSON.parse(raw);
        if (!body || Object.keys(body).length !== 1 || body.completed !== true) throw Error();
    } catch {
        return json({ error: "Complete the tutorial to continue." }, 400);
    }
    try {
        await withAccountUpload(user.id, async (client) => {
            await client.query(
                "insert into seller_notebooks(owner_id,display_name,revision,tour_completed_at) values($1,$2,0,now()) on conflict(owner_id) do update set tour_completed_at=coalesce(seller_notebooks.tour_completed_at,excluded.tour_completed_at)",
                [user.id, user.name],
            );
        });
        return json({ completed: true });
    } catch {
        return json({ error: "Could not save tutorial completion. Please retry." }, 503);
    }
}
