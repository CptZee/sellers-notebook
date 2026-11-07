import { timingSafeEqual, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { database } from "../../../../lib/db";
import { shopeeAuthStates, shopeeConnections } from "../../../../db/schema";
import { sessionUser, json } from "../../../../lib/api";
import { shopeeConfig, stateHash, exchangeCode, sealTokens } from "../../../../lib/shopee-api.mjs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
    const config = shopeeConfig();
    if (!config.ready) return json({ error: "Shopee app setup is not complete." }, 503);
    const destination = new URL("/notebook", config.redirectUri!);
    const jar = await cookies(),
        expected = jar.get("sn_shopee_state")?.value;
    jar.set("sn_shopee_state", "", {
        httpOnly: true,
        secure: new URL(config.redirectUri!).protocol === "https:",
        sameSite: "lax",
        path: "/api/shopee/callback",
        maxAge: 0,
    });
    try {
        const user = await sessionUser(request);
        if (!user) {
            destination.pathname = "/auth/sign-in";
            throw Error();
        }
        const query = new URL(request.url).searchParams,
            state = query.get("state"),
            code = query.get("code"),
            shopId = query.get("shop_id");
        if (
            !state ||
            !expected ||
            state.length > 100 ||
            !timingSafeEqual(Buffer.from(stateHash(state)), Buffer.from(stateHash(expected))) ||
            !code ||
            code.length > 1000 ||
            !shopId ||
            !/^\d+$/.test(shopId) ||
            !Number.isSafeInteger(Number(shopId)) ||
            Number(shopId) < 1
        )
            throw Error();
        const db = database();
        const [used] = await db
            .delete(shopeeAuthStates)
            .where(
                and(
                    eq(shopeeAuthStates.state_hash, stateHash(state)),
                    eq(shopeeAuthStates.owner_id, user.id),
                    gt(shopeeAuthStates.expires_at, new Date().toISOString()),
                ),
            )
            .returning({ id: shopeeAuthStates.owner_id });
        if (!used) throw Error();
        const tokens = await exchangeCode(config, code, shopId);
        const [saved] = await db
            .insert(shopeeConnections)
            .values({
                owner_id: user.id,
                connection_id: randomUUID(),
                shop_id: shopId,
                environment: config.environment,
                token_ciphertext: sealTokens(tokens, config.encryptionKey!, user.id, shopId),
                expires_at: tokens.expiresAt,
            })
            .onConflictDoNothing()
            .returning({ id: shopeeConnections.owner_id });
        if (!saved) throw Error();
        destination.searchParams.set("shopee", "connected");
    } catch {
        destination.searchParams.set("shopee", "authorization-failed");
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
