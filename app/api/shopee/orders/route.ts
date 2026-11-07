import { and, eq } from "drizzle-orm";
import { database } from "../../../../lib/db";
import { shopeeConnections } from "../../../../db/schema";
import { sessionUser, json, sameOrigin } from "../../../../lib/api";
import { connectedShop } from "../../../../lib/shopee-connection";
import { fetchOrderRows, ShopeeError } from "../../../../lib/shopee-api.mjs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
    try {
        const user = await sessionUser(request);
        if (!user) return json({ error: "Sign in to fetch shop orders." }, 401);
        if (!sameOrigin(request)) return json({ error: "Cross-origin request rejected." }, 403);
        let body;
        try {
            body = await request.json();
        } catch {
            return json({ error: "Choose a valid date range." }, 400);
        }
        if (
            !body ||
            typeof body.from !== "string" ||
            typeof body.to !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(body.from) ||
            !/^\d{4}-\d{2}-\d{2}$/.test(body.to)
        )
            return json({ error: "Choose valid start and end dates." }, 400);
        const from = Math.floor(Date.parse(`${body.from}T00:00:00+08:00`) / 1000),
            to = Math.min(
                Math.floor(Date.parse(`${body.to}T23:59:59+08:00`) / 1000),
                Math.floor(Date.now() / 1000),
            );
        const { config, connection, tokens } = await connectedShop(user.id);
        const rows = await fetchOrderRows(config, tokens.accessToken, connection.shop_id, from, to);
        // A disconnect while a provider request was in progress must invalidate it.
        const [stillConnected] = await database()
            .update(shopeeConnections)
            .set({ last_fetched_at: new Date().toISOString() })
            .where(
                and(
                    eq(shopeeConnections.owner_id, user.id),
                    eq(shopeeConnections.connection_id, connection.connection_id),
                ),
            )
            .returning({ id: shopeeConnections.owner_id });
        if (!stillConnected)
            return json({ error: "This shop was disconnected. Reconnect to fetch orders." }, 409);
        return json({ shopId: connection.shop_id, rows });
    } catch (error) {
        return json(
            {
                error:
                    error instanceof ShopeeError
                        ? error.message
                        : "Could not fetch shop orders. Please retry.",
            },
            502,
        );
    }
}
