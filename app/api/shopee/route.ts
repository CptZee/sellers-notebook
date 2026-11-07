import { eq } from "drizzle-orm";
import { database } from "../../../lib/db";
import { shopeeConnections, shopeeAuthStates } from "../../../db/schema";
import { sessionUser, json, sameOrigin } from "../../../lib/api";
import { shopeeConfig } from "../../../lib/shopee-api.mjs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
    try {
        const user = await sessionUser(request);
        if (!user) return json({ error: "Sign in to manage your shop connection." }, 401);
        const config = shopeeConfig();
        const [shop] = await database()
            .select({
                shopId: shopeeConnections.shop_id,
                environment: shopeeConnections.environment,
                lastFetchedAt: shopeeConnections.last_fetched_at,
                connectedAt: shopeeConnections.connected_at,
            })
            .from(shopeeConnections)
            .where(eq(shopeeConnections.owner_id, user.id));
        return json({
            configured: config.ready,
            environment: config.environment,
            callbackUrl: config.ready ? config.redirectUri : null,
            connected: !!shop,
            shop: shop || null,
        });
    } catch {
        return json({ error: "Could not load your shop connection. Please retry." }, 503);
    }
}
export async function DELETE(request: Request) {
    try {
        const user = await sessionUser(request);
        if (!user) return json({ error: "Sign in again." }, 401);
        if (!sameOrigin(request)) return json({ error: "Cross-origin request rejected." }, 403);
        const db = database();
        await db.delete(shopeeConnections).where(eq(shopeeConnections.owner_id, user.id));
        await db.delete(shopeeAuthStates).where(eq(shopeeAuthStates.owner_id, user.id));
        return json({ disconnected: true });
    } catch {
        return json({ error: "Could not disconnect this shop. Please retry." }, 503);
    }
}
