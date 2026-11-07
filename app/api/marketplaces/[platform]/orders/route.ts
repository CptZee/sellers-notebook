import { and, eq } from "drizzle-orm";
import { sessionUser, json, sameOrigin } from "../../../../../lib/api";
import { routePlatform, type MarketplaceContext } from "../../../../../lib/marketplace-routes";
import { marketplaceConfig } from "../../../../../lib/marketplace-api.mjs";
import {
    marketplaceRange,
    marketplaceImportEnabled,
    fetchMarketplaceOrders,
    MarketplaceError,
} from "../../../../../lib/marketplace-orders.mjs";
import { connectedMarketplace } from "../../../../../lib/marketplace-connection";
import { database } from "../../../../../lib/db";
import { marketplaceConnections as connections } from "../../../../../db/schema";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: MarketplaceContext) {
    try {
        const platform = await routePlatform(context);
        if (!platform) return json({ error: "Unknown marketplace." }, 404);
        const user = await sessionUser(request);
        if (!user) return json({ error: "Sign in to fetch your shop orders." }, 401);
        if (!sameOrigin(request)) return json({ error: "Cross-origin request rejected." }, 403);
        if (!marketplaceConfig(platform).ready || !marketplaceImportEnabled(platform))
            return json(
                { error: "Direct order fetching is coming soon. CSV imports are available now." },
                503,
            );
        const raw = await request.text();
        if (raw.length > 2000) return json({ error: "Invalid fetch request." }, 413);
        let body;
        try {
            body = JSON.parse(raw);
        } catch {
            return json({ error: "Choose a valid date range." }, 400);
        }
        if (
            !body ||
            Object.keys(body).some((k) => !["from", "to", "shopCipher"].includes(k)) ||
            (body.shopCipher !== undefined &&
                (typeof body.shopCipher !== "string" || body.shopCipher.length > 100))
        )
            return json({ error: "Invalid fetch request." }, 400);
        let range;
        try {
            range = marketplaceRange(body.from, body.to);
        } catch (e) {
            return json({ error: e instanceof Error ? e.message : "Invalid range." }, 400);
        }
        const { config, connection, tokens } = await connectedMarketplace(user.id, platform),
            result = await fetchMarketplaceOrders(config, tokens, range, {
                shopCipher: body.shopCipher,
            });
        const [stillConnected] = await database()
            .select({ id: connections.connection_id })
            .from(connections)
            .where(
                and(
                    eq(connections.owner_id, user.id),
                    eq(connections.platform, platform),
                    eq(connections.connection_id, connection.connection_id),
                    eq(connections.app_fingerprint, config.fingerprint!),
                ),
            );
        if (!stillConnected)
            return json(
                { error: "This shop was disconnected. Reconnect before fetching orders." },
                409,
            );
        return json({
            platform: platform === "lazada" ? "Lazada" : "TikTok Shop",
            shopId: result.shopId || connection.account_id,
            ...result,
        });
    } catch (e) {
        return json(
            {
                error:
                    e instanceof MarketplaceError
                        ? e.message
                        : "Could not fetch marketplace orders. Retry or reconnect your shop.",
            },
            502,
        );
    }
}
