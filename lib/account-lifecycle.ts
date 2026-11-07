import { Pool, neonConfig, type PoolClient } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { database } from "./db";
let pool: Pool | undefined;
export function lifecyclePool() {
    neonConfig.webSocketConstructor = WebSocket;
    if (!pool) {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            max: 4,
            connectionTimeoutMillis: 5000,
            query_timeout: 15000,
        });
        pool.on("error", () => console.warn("Account lifecycle database connection interrupted."));
    }
    return pool;
}
export async function accountDeleting(owner: string) {
    const result = await database().execute(
        sql`select exists(select 1 from seller_account_deletions where owner_id=${owner}) deleting`,
    );
    return result.rows[0].deleting === true;
}
/** Serializes file uploads with deletion preparation; SQL writes use the same lock in DB triggers. */
export async function withAccountUpload<T>(
    owner: string,
    operation: (client: PoolClient) => Promise<T>,
) {
    const client = await lifecyclePool().connect();
    let discard = false;
    try {
        await client.query("BEGIN");
        await client.query("SET LOCAL lock_timeout='5s'");
        await client.query(
            "select pg_advisory_xact_lock(hashtext('seller-account-lifecycle'),hashtext($1))",
            [owner],
        );
        if (
            (
                await client.query("select 1 from seller_account_deletions where owner_id=$1", [
                    owner,
                ])
            ).rowCount
        )
            throw Error("Account deletion is in progress.");
        const result = await operation(client);
        await client.query("COMMIT");
        return result;
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {
            discard = true;
        });
        throw error;
    } finally {
        client.release(discard);
    }
}
