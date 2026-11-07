import { randomBytes, randomUUID } from "node:crypto";
import { lifecyclePool } from "./account-lifecycle";
import { storage } from "./storage";
import { deletionConfig, resumeHash, matchesResume, ownsDeletionKey } from "./account-deletion.mjs";

async function identityTarget() {
    const config = deletionConfig();
    if (!config) throw Error("Account deletion is not configured.");
    const response = await fetch(config.base, {
        headers: { Authorization: "Bearer " + config.key },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw Error("Identity service is unavailable.");
    const data = await response.json();
    if (
        String(data.base_url || "").replace(/\/$/, "") !==
        String(process.env.NEON_AUTH_BASE_URL || "").replace(/\/$/, "")
    )
        throw Error("Identity target does not match this app.");
    return config;
}
export async function prepareAccountDeletion(owner: string) {
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(owner)) throw Error("Invalid account identity.");
    await identityTarget();
    const client = await lifecyclePool().connect(),
        token = randomBytes(32).toString("base64url");
    try {
        await client.query("BEGIN");
        await client.query("SET LOCAL lock_timeout='5s'");
        await client.query(
            "select pg_advisory_xact_lock(hashtext('seller-account-lifecycle'),hashtext($1))",
            [owner],
        );
        const result = await client.query(
            "insert into seller_account_deletions(owner_id,id,resume_hash) values($1,$2,$3) on conflict(owner_id) do update set resume_hash=excluded.resume_hash,updated_at=now() returning id,phase",
            [owner, randomUUID(), resumeHash(token)],
        );
        await client.query("COMMIT");
        return { ...result.rows[0], token };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}
export async function advanceAccountDeletion(id: string, token: string) {
    const client = await lifecyclePool().connect();
    let owner: string | undefined,
        locked = false;
    try {
        let row = (await client.query("select * from seller_account_deletions where id=$1", [id]))
            .rows[0];
        if (!row || !matchesResume(token, row.resume_hash)) return null;
        owner = row.owner_id;
        locked = (
            await client.query(
                "select pg_try_advisory_lock(hashtext('seller-account-lifecycle'),hashtext($1)) locked",
                [owner],
            )
        ).rows[0].locked;
        if (!locked) throw Error("Another deletion step is running.");
        row = (await client.query("select * from seller_account_deletions where id=$1", [id]))
            .rows[0];
        if (!matchesResume(token, row.resume_hash)) return null;
        const next = async (phase: string) => {
            await client.query(
                "update seller_account_deletions set phase=$2,updated_at=now() where id=$1",
                [id, phase],
            );
            return { phase };
        };
        if (row.phase === "complete") return { phase: "complete" };
        if (row.phase === "files") {
            const files = storage(),
                signal = AbortSignal.timeout(20000);
            let removed = 0;
            for (const prefix of [`notebooks/${owner}/`, `profiles/${owner}/`]) {
                const page = await files.list({ prefix, limit: 10 - removed, signal });
                for (const item of page.items) {
                    if (!ownsDeletionKey(owner!, item.key)) throw Error("Unexpected file scope.");
                    await files.delete(item.key, { signal });
                    removed++;
                    if (removed === 10) break;
                }
                if (removed === 10) break;
            }
            // Re-list from the start on every step: deletion is restartable without stale cursors.
            return removed ? { phase: "files", removed } : next("records");
        }
        if (row.phase === "records") {
            await client.query("BEGIN");
            try {
                await client.query("select set_config('seller.account_cleanup',$1,true)", [owner]);
                for (const table of [
                    "seller_marketplace_sync_settings",
                    "seller_marketplace_auth_states",
                    "seller_marketplace_connections",
                    "seller_shopee_auth_states",
                    "seller_shopee_connections",
                    "seller_attachments",
                    "seller_notebooks",
                ])
                    await client.query(`delete from ${table} where owner_id=$1`, [owner]);
                const tables = (
                    await client.query(
                        "select tablename from pg_tables where schemaname='public' and tablename<>'seller_account_deletions' and tablename in(select table_name from information_schema.columns where table_schema='public' and column_name='owner_id')",
                    )
                ).rows;
                for (const { tablename } of tables) {
                    if (!/^seller_[a-z_]+$/.test(tablename)) throw Error("Unexpected owner table.");
                    if (
                        (
                            await client.query(
                                `select 1 from ${tablename} where owner_id=$1 limit 1`,
                                [owner],
                            )
                        ).rowCount
                    )
                        throw Error("Account records remain.");
                }
                await client.query(
                    "update seller_account_deletions set phase='identity',updated_at=now() where id=$1",
                    [id],
                );
                await client.query("COMMIT");
                return { phase: "identity" };
            } catch (error) {
                await client.query("ROLLBACK");
                throw error;
            }
        }
        if (row.phase === "identity") {
            const config = await identityTarget();
            const response = await fetch(config.base + "/users/" + encodeURIComponent(owner!), {
                method: "DELETE",
                headers: { Authorization: "Bearer " + config.key },
                cache: "no-store",
                redirect: "error",
                signal: AbortSignal.timeout(15000),
            });
            if (!response.ok && response.status !== 404)
                throw Error("Identity removal is unavailable.");
            return next("complete");
        }
        throw Error("Unknown deletion phase.");
    } finally {
        let discard = false;
        if (locked && owner)
            try {
                discard = !(
                    await client.query(
                        "select pg_advisory_unlock(hashtext('seller-account-lifecycle'),hashtext($1)) unlocked",
                        [owner],
                    )
                ).rows[0].unlocked;
            } catch {
                discard = true;
            }
        client.release(discard);
    }
}
