import { and, eq, or, isNull, lt } from "drizzle-orm";
import { database } from "./db";
import { marketplaceConnections as connections } from "../db/schema";
import {
    marketplaceConfig,
    decryptMarketplaceTokens,
    encryptMarketplaceTokens,
    type Platform,
} from "./marketplace-api.mjs";
import { MarketplaceError, refreshMarketplaceTokens } from "./marketplace-orders.mjs";
export async function connectedMarketplace(owner: string, platform: Platform) {
    const config = marketplaceConfig(platform);
    if (!config.ready) throw new MarketplaceError("Connection is coming soon.");
    const db = database(),
        scope = and(eq(connections.owner_id, owner), eq(connections.platform, platform));
    const [connection] = await db.select().from(connections).where(scope);
    if (!connection) throw new MarketplaceError("Connect your own shop before fetching orders.");
    if (connection.app_fingerprint !== config.fingerprint)
        throw new MarketplaceError("App setup changed. Disconnect and reconnect this shop.");
    let tokens = decryptMarketplaceTokens(
        connection.token_ciphertext,
        config.encryptionKey!,
        owner,
        platform,
        connection.account_id,
    );
    if (tokens.accountId !== connection.account_id)
        throw new MarketplaceError("Reconnect this shop to continue.");
    if (new Date(connection.expires_at).getTime() > Date.now() + 120000)
        return { config, connection, tokens };
    const now = new Date().toISOString(),
        until = new Date(Date.now() + 60000).toISOString(),
        identity = and(scope, eq(connections.connection_id, connection.connection_id));
    const [claim] = await db
        .update(connections)
        .set({ refresh_locked_until: until })
        .where(
            and(
                identity,
                eq(connections.token_ciphertext, connection.token_ciphertext),
                or(
                    isNull(connections.refresh_locked_until),
                    lt(connections.refresh_locked_until, now),
                ),
            ),
        )
        .returning({ id: connections.connection_id });
    if (!claim)
        throw new MarketplaceError(
            "This shop is refreshing its authorization. Wait a moment and retry.",
        );
    try {
        tokens = await refreshMarketplaceTokens(config, tokens);
        const [saved] = await db
            .update(connections)
            .set({
                token_ciphertext: encryptMarketplaceTokens(
                    tokens,
                    config.encryptionKey!,
                    owner,
                    platform,
                    connection.account_id,
                ),
                expires_at: tokens.expiresAt,
                refresh_locked_until: null,
            })
            .where(
                and(
                    identity,
                    eq(connections.refresh_locked_until, until),
                    eq(connections.token_ciphertext, connection.token_ciphertext),
                ),
            )
            .returning({ id: connections.connection_id });
        if (!saved)
            throw new MarketplaceError(
                "This shop connection changed. Reconnect or retry its latest version.",
            );
        return { config, connection, tokens };
    } finally {
        await db
            .update(connections)
            .set({ refresh_locked_until: null })
            .where(and(identity, eq(connections.refresh_locked_until, until)))
            .catch(() => {});
    }
}
