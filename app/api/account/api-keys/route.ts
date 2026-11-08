import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { database } from "../../../../lib/db";
import { json, sameOrigin, sessionUser } from "../../../../lib/api";
import { withAccountUpload } from "../../../../lib/account-lifecycle";
import { createApiToken, hashApiToken, keyInput } from "../../../../lib/api-token.mjs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
    try {
        const user = await sessionUser(request);
        if (!user) return json({ error: "Sign in to manage API keys." }, 401);
        const result = await database().execute(
            sql`select id,name,purpose,scope,prefix,created_at,expires_at,revoked_at from seller_api_keys where owner_id=${user.id} order by created_at desc limit 100`,
        );
        return json({ keys: result.rows });
    } catch {
        return json({ error: "API keys are temporarily unavailable." }, 503);
    }
}
export async function POST(request: Request) {
    if (!sameOrigin(request)) return json({ error: "Cross-origin write rejected." }, 403);
    try {
        const user = await sessionUser(request);
        if (!user) return json({ error: "Sign in to create an API key." }, 401);
        let input;
        try {
            input = keyInput(await request.json());
        } catch {
            return json({ error: "Enter a name, purpose and access level." }, 400);
        }
        const token = createApiToken(),
            id = randomUUID();
        const created = await withAccountUpload(user.id, async (client) => {
            await client.query(
                "insert into seller_notebooks(owner_id,display_name,revision) values($1,$2,0) on conflict do nothing",
                [user.id, user.name],
            );
            const count = await client.query(
                "select count(*)::int total from seller_api_keys where owner_id=$1 and revoked_at is null and expires_at>now()",
                [user.id],
            );
            if (count.rows[0].total >= 10) return null;
            return (
                await client.query(
                    "insert into seller_api_keys(id,owner_id,name,purpose,scope,token_hash,prefix,expires_at) values($1,$2,$3,$4,$5,$6,$7,now()+interval '90 days') returning id,expires_at",
                    [
                        id,
                        user.id,
                        input.name,
                        input.purpose,
                        input.scope,
                        hashApiToken(token),
                        token.slice(0, 12),
                    ],
                )
            ).rows[0];
        });
        return created
            ? json({ ...created, token }, 201)
            : json({ error: "Revoke an existing key first. Maximum 10 active keys." }, 409);
    } catch {
        return json({ error: "API key could not be created." }, 503);
    }
}
export async function DELETE(request: Request) {
    if (!sameOrigin(request)) return json({ error: "Cross-origin write rejected." }, 403);
    try {
        const user = await sessionUser(request);
        if (!user) return json({ error: "Sign in to revoke an API key." }, 401);
        const id = new URL(request.url).searchParams.get("id");
        if (!id || !/^[a-f0-9-]{36}$/i.test(id)) return json({ error: "Invalid key ID." }, 400);
        await database().execute(
            sql`update seller_api_keys set revoked_at=now() where id=${id}::uuid and owner_id=${user.id}`,
        );
        return json({ revoked: true });
    } catch {
        return json({ error: "API key could not be revoked." }, 503);
    }
}
