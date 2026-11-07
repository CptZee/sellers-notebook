import { disableMarketplaceSync } from "./marketplace-sync";
import { marketplaceImportEnabled } from "./marketplace-orders.mjs";
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, gt, lt } from "drizzle-orm";
import { database } from "./db";
import {
    marketplaceConnections as connections,
    marketplaceAuthStates as states,
} from "../db/schema";
import { sessionUser, sameOrigin, json } from "./api";
import {
    marketplaceConfig,
    marketplaceAuthorizationUrl,
    exchangeMarketplaceCode,
    encryptMarketplaceTokens,
    type Platform,
} from "./marketplace-api.mjs";
import { stateHash } from "./shopee-api.mjs";

export type MarketplaceContext = { params: Promise<{ platform: string }> };
export async function routePlatform(context: MarketplaceContext): Promise<Platform | null> {
    const { platform } = await context.params;
    return platform === "lazada" || platform === "tiktok" ? platform : null;
}
const scope = (owner: string, platform: Platform) =>
    and(eq(connections.owner_id, owner), eq(connections.platform, platform));

export async function marketplaceStatus(request: Request, platform: Platform) {
    try {
        const user = await sessionUser(request);
        if (!user) return json({ error: "Sign in to manage connections." }, 401);
        const config = marketplaceConfig(platform);
        const [row] = await database()
            .select({
                accountId: connections.account_id,
                expiresAt: connections.expires_at,
                connectedAt: connections.connected_at,
                fingerprint: connections.app_fingerprint,
            })
            .from(connections)
            .where(scope(user.id, platform));
        return json({
            configured: config.ready,
            connected: !!row,
            needsReconnect: !!row && row.fingerprint !== config.fingerprint,
            account: row ? { id: row.accountId, connectedAt: row.connectedAt } : null,
            orderImportAvailable: config.ready && marketplaceImportEnabled(platform),
        });
    } catch {
        return json({ error: "Could not load this connection. Please retry." }, 503);
    }
}
export async function marketplaceDisconnect(request: Request, platform: Platform) {
    try {
        const user = await sessionUser(request);
        if (!user) return json({ error: "Sign in again." }, 401);
        if (!sameOrigin(request)) return json({ error: "Cross-origin request rejected." }, 403);
        await disableMarketplaceSync(user.id, platform);
        await database().delete(connections).where(scope(user.id, platform));
        await database()
            .delete(states)
            .where(and(eq(states.owner_id, user.id), eq(states.platform, platform)));
        return json({ disconnected: true });
    } catch {
        return json({ error: "Could not disconnect. Please retry." }, 503);
    }
}
export async function marketplaceConnect(request: Request, platform: Platform) {
    try {
        const user = await sessionUser(request);
        if (!user) return json({ error: "Sign in to connect your shop." }, 401);
        if (!sameOrigin(request)) return json({ error: "Cross-origin request rejected." }, 403);
        const config = marketplaceConfig(platform);
        if (!config.ready)
            return json(
                { error: "This connection is coming soon. Please try again once it is available." },
                503,
            );
        const db = database();
        const [existing] = await db
            .select({ id: connections.connection_id })
            .from(connections)
            .where(scope(user.id, platform));
        if (existing)
            return json(
                { error: "Disconnect the existing account before authorizing again." },
                409,
            );
        const state = randomBytes(32).toString("base64url");
        await db
            .delete(states)
            .where(
                and(
                    eq(states.owner_id, user.id),
                    eq(states.platform, platform),
                    lt(states.expires_at, new Date().toISOString()),
                ),
            );
        await db.insert(states).values({
            state_hash: stateHash(state),
            owner_id: user.id,
            platform,
            app_fingerprint: config.fingerprint!,
            expires_at: new Date(Date.now() + 600000).toISOString(),
        });
        (await cookies()).set(`sn_${platform}_state`, state, {
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            path: `/api/marketplaces/${platform}/callback`,
            maxAge: 600,
        });
        return json({ authorizationUrl: marketplaceAuthorizationUrl(config, state) });
    } catch {
        return json({ error: "Could not start authorization. Please retry." }, 503);
    }
}
export async function marketplaceCallback(request: Request, platform: Platform) {
    const config = marketplaceConfig(platform);
    if (!config.ready) return json({ error: "This connection is not available yet." }, 503);
    const destination = new URL("/notebook", config.redirectUri!);
    const jar = await cookies(),
        expected = jar.get(`sn_${platform}_state`)?.value;
    jar.set(`sn_${platform}_state`, "", {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: `/api/marketplaces/${platform}/callback`,
        maxAge: 0,
    });
    try {
        const user = await sessionUser(request);
        if (!user) throw Error();
        const params = new URL(request.url).searchParams,
            state = params.get("state"),
            code = params.get("code");
        if (
            params.has("error") ||
            !state ||
            !expected ||
            state.length > 100 ||
            !timingSafeEqual(Buffer.from(stateHash(state)), Buffer.from(stateHash(expected))) ||
            !code ||
            code.length > 2000
        )
            throw Error();
        const db = database();
        const [used] = await db
            .delete(states)
            .where(
                and(
                    eq(states.state_hash, stateHash(state)),
                    eq(states.owner_id, user.id),
                    eq(states.platform, platform),
                    eq(states.app_fingerprint, config.fingerprint!),
                    gt(states.expires_at, new Date().toISOString()),
                ),
            )
            .returning({ id: states.owner_id });
        if (!used) throw Error();
        const tokens = await exchangeMarketplaceCode(config, code);
        const [saved] = await db
            .insert(connections)
            .values({
                owner_id: user.id,
                platform,
                connection_id: randomUUID(),
                account_id: tokens.accountId,
                app_fingerprint: config.fingerprint!,
                token_ciphertext: encryptMarketplaceTokens(
                    tokens,
                    config.encryptionKey!,
                    user.id,
                    platform,
                    tokens.accountId,
                ),
                expires_at: tokens.expiresAt,
            })
            .onConflictDoNothing()
            .returning({ id: connections.connection_id });
        if (!saved) throw Error();
        destination.searchParams.set("marketplace", `${platform}-connected`);
    } catch {
        destination.searchParams.set("marketplace", `${platform}-authorization-failed`);
    }
    return new Response(null, {
        status: 303,
        headers: {
            Location: destination.href,
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer",
        },
    });
}
