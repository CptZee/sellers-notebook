import { createRealtime, rawSql } from "@neon/realtime/server";
import { sessionUser, json } from "../../../lib/api";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
    const user = await sessionUser(request);
    if (!user) return json({ error: "Sign in again to resume live updates." }, 401);
    const realtime = createRealtime({
        secret: process.env.NEON_REALTIME_SECRET!,
        db: new URL(process.env.DATABASE_URL!).pathname.slice(1),
    });
    const sealedQuery = await realtime.seal({
        query: rawSql(
            "SELECT owner_id, revision, updated_at FROM seller_notebooks WHERE owner_id = $1",
            [user.id],
        ),
    });
    return json({ sealedQuery, url: process.env.NEON_REALTIME_URL! });
}
