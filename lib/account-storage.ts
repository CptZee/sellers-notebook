import type { PoolClient } from "@neondatabase/serverless";
import { FilesError } from "files-sdk";
import { withAccountUpload } from "./account-lifecycle";
import { storage } from "./storage";
import { storageUsage } from "./storage-usage.mjs";

async function avatarBytes(owner: string) {
    try {
        return (
            await storage().head(`profiles/${owner}/avatar.webp`, {
                signal: AbortSignal.timeout(10000),
            })
        ).size;
    } catch (error) {
        if (error instanceof FilesError && error.code === "NotFound") return 0;
        throw error;
    }
}
export async function accountStorage(client: PoolClient, owner: string) {
    const [result, profileBytes] = await Promise.all([
        client.query(
            `select
   (select coalesce(sum(size),0)::text from seller_attachments where owner_id=$1) attachments,
   (select coalesce(sum(bytes),0)::text from seller_storage_reservations where owner_id=$1) pending`,
            [owner],
        ),
        avatarBytes(owner),
    ]);
    const row = result.rows[0];
    return storageUsage(Number(row.attachments), profileBytes, Number(row.pending));
}
export async function readAccountStorage(owner: string) {
    return withAccountUpload(owner, (client) => accountStorage(client, owner));
}
/** Commit the reservation before touching object storage; interrupted uploads can still be recovered safely. */
export async function reserveAttachment(
    owner: string,
    id: string,
    key: string,
    bytes: number,
    name = "My notebook",
) {
    return withAccountUpload(owner, async (client) => {
        await client.query(
            "insert into seller_notebooks(owner_id,display_name,revision) values($1,$2,0) on conflict do nothing",
            [owner, name],
        );
        await client.query(
            "insert into seller_storage_reservations(id,owner_id,object_key,bytes) values($1,$2,$3,$4)",
            [id, owner, key, bytes],
        );
    });
}
export async function deleteStoredObject(key: string) {
    try {
        await storage().delete(key, { signal: AbortSignal.timeout(15000) });
    } catch (error) {
        if (!(error instanceof FilesError && error.code === "NotFound")) throw error;
    }
}

/** Resolve failed/ambiguous commits without deleting an attachment whose metadata committed. */
export async function settleFailedAttachment(owner: string, id: string) {
    return withAccountUpload(owner, async (client) => {
        if (
            (
                await client.query("select 1 from seller_attachments where owner_id=$1 and id=$2", [
                    owner,
                    id,
                ])
            ).rowCount
        )
            return true;
        const reservation = (
            await client.query(
                "select object_key from seller_storage_reservations where owner_id=$1 and id=$2",
                [owner, id],
            )
        ).rows[0];
        if (reservation) {
            await deleteStoredObject(reservation.object_key);
            await client.query(
                "delete from seller_storage_reservations where owner_id=$1 and id=$2",
                [owner, id],
            );
        }
        return false;
    });
}
export async function recoverStorage(owner: string) {
    return withAccountUpload(owner, async (client) => {
        const stale = await client.query(
            "select id,object_key from seller_storage_reservations where owner_id=$1 and created_at<now()-interval '10 minutes' order by created_at limit 3",
            [owner],
        );
        for (const row of stale.rows) {
            if (
                !(
                    await client.query(
                        "select 1 from seller_attachments where owner_id=$1 and id=$2",
                        [owner, row.id],
                    )
                ).rowCount
            )
                await deleteStoredObject(row.object_key);
            await client.query(
                "delete from seller_storage_reservations where owner_id=$1 and id=$2",
                [owner, row.id],
            );
        }
        return { recovered: stale.rowCount || 0 };
    });
}
