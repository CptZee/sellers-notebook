import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, lt } from "drizzle-orm";
import { database } from "../../../../lib/db";
import { shopeeAuthStates, shopeeConnections } from "../../../../db/schema";
import { sessionUser, json, sameOrigin } from "../../../../lib/api";
import { shopeeConfig, authorizationUrl, stateHash } from "../../../../lib/shopee-api.mjs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
    try {
        const user = await sessionUser(request);
        if (!user) return json({ error: "Sign in to connect Shopee." }, 401);
        if (!sameOrigin(request)) return json({ error: "Cross-origin request rejected." }, 403);
        const config = shopeeConfig();
        if (!config.ready)
            return json(
                {
                    error: "Shopee connection is coming soon. Please try again once it is available.",
                },
                503,
            );
        const db = database();
        const [existing] = await db
            .select({ id: shopeeConnections.owner_id })
            .from(shopeeConnections)
            .where(eq(shopeeConnections.owner_id, user.id));
        if (existing)
            return json(
                { error: "Disconnect your existing shop before connecting another one." },
                409,
            );
        const state = randomBytes(32).toString("base64url");
        await db
            .delete(shopeeAuthStates)
            .where(
                and(
                    eq(shopeeAuthStates.owner_id, user.id),
                    lt(shopeeAuthStates.expires_at, new Date().toISOString()),
                ),
            );
        await db.insert(shopeeAuthStates).values({
            state_hash: stateHash(state),
            owner_id: user.id,
            expires_at: new Date(Date.now() + 600000).toISOString(),
        });
        (await cookies()).set("sn_shopee_state", state, {
            httpOnly: true,
            secure: new URL(config.redirectUri!).protocol === "https:",
            sameSite: "lax",
            path: "/api/shopee/callback",
            maxAge: 600,
        });
        return json({ authorizationUrl: authorizationUrl(config, state) });
    } catch {
        return json({ error: "Could not start Shopee authorization. Please retry." }, 503);
    }
}
