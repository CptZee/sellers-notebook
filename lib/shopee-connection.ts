import { and, eq, or, isNull, lt } from "drizzle-orm";
import { database } from "./db";
import { shopeeConnections } from "../db/schema";
import { shopeeConfig, openTokens, sealTokens, refreshTokens, ShopeeError } from "./shopee-api.mjs";

export async function connectedShop(ownerId: string) {
    const config = shopeeConfig();
    if (!config.ready) throw new ShopeeError("Shopee app setup is not complete yet.");
    const db = database();
    const [connection] = await db
        .select()
        .from(shopeeConnections)
        .where(eq(shopeeConnections.owner_id, ownerId));
    if (!connection) throw new ShopeeError("Connect a Shopee shop first.");
    if (connection.environment !== config.environment)
        throw new ShopeeError("The app environment changed. Disconnect and reconnect this shop.");
    let tokens = openTokens(
        connection.token_ciphertext,
        config.encryptionKey!,
        ownerId,
        connection.shop_id,
    );
    if (new Date(connection.expires_at).getTime() > Date.now() + 60000)
        return { config, connection, tokens };
    const now = new Date().toISOString(),
        until = new Date(Date.now() + 60000).toISOString();
    const [claimed] = await db
        .update(shopeeConnections)
        .set({ refresh_locked_until: until })
        .where(
            and(
                eq(shopeeConnections.owner_id, ownerId),
                eq(shopeeConnections.connection_id, connection.connection_id),
                eq(shopeeConnections.expires_at, connection.expires_at),
                or(
                    isNull(shopeeConnections.refresh_locked_until),
                    lt(shopeeConnections.refresh_locked_until, now),
                ),
            ),
        )
        .returning({ id: shopeeConnections.owner_id });
    if (!claimed) {
        const [current] = await db
            .select()
            .from(shopeeConnections)
            .where(
                and(
                    eq(shopeeConnections.owner_id, ownerId),
                    eq(shopeeConnections.connection_id, connection.connection_id),
                ),
            );
        if (current && new Date(current.expires_at).getTime() > Date.now() + 60000)
            return {
                config,
                connection: current,
                tokens: openTokens(
                    current.token_ciphertext,
                    config.encryptionKey!,
                    ownerId,
                    current.shop_id,
                ),
            };
        throw new ShopeeError("This shop is reconnecting. Wait a moment and try again.");
    }
    try {
        tokens = await refreshTokens(config, tokens.refreshToken, connection.shop_id);
        const [updated] = await db
            .update(shopeeConnections)
            .set({
                token_ciphertext: sealTokens(
                    tokens,
                    config.encryptionKey!,
                    ownerId,
                    connection.shop_id,
                ),
                expires_at: tokens.expiresAt,
                refresh_locked_until: null,
            })
            .where(
                and(
                    eq(shopeeConnections.owner_id, ownerId),
                    eq(shopeeConnections.connection_id, connection.connection_id),
                    eq(shopeeConnections.refresh_locked_until, until),
                ),
            )
            .returning({ id: shopeeConnections.owner_id });
        if (!updated)
            throw new ShopeeError("This shop was disconnected. Connect it again to continue.");
        return { config, connection, tokens };
    } finally {
        await db
            .update(shopeeConnections)
            .set({ refresh_locked_until: null })
            .where(
                and(
                    eq(shopeeConnections.owner_id, ownerId),
                    eq(shopeeConnections.connection_id, connection.connection_id),
                    eq(shopeeConnections.refresh_locked_until, until),
                ),
            )
            .catch(() => {});
    }
}
