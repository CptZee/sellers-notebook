import { sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { database } from "./db";
import { connectedMarketplace } from "./marketplace-connection";
import { fetchMarketplaceOrders, marketplaceRange } from "./marketplace-orders.mjs";
import { syncFailure } from "./sync-policy.mjs";
import type { Platform } from "./marketplace-api.mjs";
type Job = {
    owner_id: string;
    id: string;
    platform: Platform;
    connection_id: string;
    shop_cipher: string | null;
    attempts: number;
    from_date: string;
    to_date: string;
    lease_token: string;
};
export async function enqueueSync(platforms: Platform[]) {
    const result = await database().execute(sql`with due as (
  select s.* from seller_marketplace_sync_settings s join seller_marketplace_connections c on c.owner_id=s.owner_id and c.platform=s.platform and c.connection_id=s.connection_id
  where s.enabled and s.next_run_at<=now() and s.platform in (select jsonb_array_elements_text(${JSON.stringify(platforms)}::jsonb)) and not exists(select 1 from seller_marketplace_sync_runs r where r.owner_id=s.owner_id and r.platform=s.platform and r.status in ('queued','retrying','running'))
  order by s.next_run_at for update of s skip locked limit 5
 ), inserted as (
  insert into seller_marketplace_sync_runs(owner_id,platform,connection_id,shop_cipher,from_date,to_date)
  select owner_id,platform,connection_id,shop_cipher,(now() at time zone 'Asia/Manila')::date-(lookback_days-1),(now() at time zone 'Asia/Manila')::date from due on conflict do nothing returning owner_id,platform
 ) update seller_marketplace_sync_settings s set next_run_at=now()+s.interval_minutes*interval '1 minute' from inserted i where s.owner_id=i.owner_id and s.platform=i.platform returning s.platform`);
    return result.rows.length;
}
export async function claimSync(platforms: Platform[]) {
    await database().execute(
        sql`update seller_marketplace_sync_runs set status='failed',finished_at=now(),lease_token=null,lease_until=null,error_message='The worker stopped before completion. Review the connection and retry.' where status='running' and lease_until<now() and attempts>=3`,
    );
    const token = randomUUID();
    const result = await database().execute(sql`with candidate as (
  select r.owner_id,r.id from seller_marketplace_sync_runs r join seller_marketplace_sync_settings s on s.owner_id=r.owner_id and s.platform=r.platform join seller_marketplace_connections c on c.owner_id=r.owner_id and c.platform=r.platform and c.connection_id=r.connection_id
  where s.enabled and s.connection_id=r.connection_id and s.shop_cipher is not distinct from r.shop_cipher and r.platform in(select jsonb_array_elements_text(${JSON.stringify(platforms)}::jsonb)) and r.attempts<3 and (r.status in ('queued','retrying') and r.available_at<=now() or r.status='running' and r.lease_until<now())
  order by r.available_at,r.created_at for update of r skip locked limit 1
 ) update seller_marketplace_sync_runs r set status='running',attempts=r.attempts+1,lease_token=${token}::uuid,lease_until=now()+interval '120 seconds',error_message=null from candidate j where r.owner_id=j.owner_id and r.id=j.id returning r.*,r.from_date::text as from_date,r.to_date::text as to_date`);
    return result.rows[0] as unknown as Job | undefined;
}
export async function stageSync(job: Job, rows: Record<string, string>[]) {
    if (rows.length > 1000) throw Error("Sync batch limit exceeded.");
    const result = await database().execute(sql`with eligible as (
  select r.id,r.owner_id from seller_marketplace_sync_runs r join seller_marketplace_sync_settings s on s.owner_id=r.owner_id and s.platform=r.platform join seller_marketplace_connections c on c.owner_id=r.owner_id and c.platform=r.platform and c.connection_id=r.connection_id
  where r.owner_id=${job.owner_id} and r.id=${job.id}::uuid and r.status='running' and r.lease_token=${job.lease_token}::uuid and r.lease_until>now() and s.enabled and s.connection_id=r.connection_id and s.shop_cipher is not distinct from r.shop_cipher for update of r,s,c
 ), inserted as (
  insert into seller_marketplace_sync_rows(owner_id,run_id,position,source_order_id,sku,quantity,unit_price,ordered_on,status,buyer,currency)
  select e.owner_id,e.id,a.ordinality-1,a.value->>'Order ID',a.value->>'Seller SKU',(a.value->>'Quantity')::int,(a.value->>'Unit Price')::numeric,(a.value->>'Order Date')::date,a.value->>'Order Status',coalesce(a.value->>'Buyer Username','Marketplace buyer'),a.value->>'Currency'
  from eligible e cross join jsonb_array_elements(${JSON.stringify(rows)}::jsonb) with ordinality a
 ) update seller_marketplace_sync_runs r set status='ready',rows_count=${rows.length},finished_at=now(),lease_token=null,lease_until=null,error_message=null where r.owner_id=${job.owner_id} and r.id=${job.id}::uuid and exists(select 1 from eligible) returning r.id`);
    return result.rows.length > 0;
}
export async function finishSyncFailure(job: Job, error: unknown, cancelled = false) {
    const failure = syncFailure(error, job.attempts),
        status = cancelled ? "cancelled" : failure.retry ? "retrying" : "failed";
    await database().execute(
        sql`update seller_marketplace_sync_runs set status=${status},error_message=${cancelled ? "The schedule or connection changed before the batch completed." : failure.message},available_at=now()+${failure.delaySeconds}*interval '1 second',finished_at=case when ${status}='retrying' then null else now() end,lease_token=null,lease_until=null where owner_id=${job.owner_id} and id=${job.id}::uuid and status='running' and lease_token=${job.lease_token}::uuid`,
    );
}
export async function workMarketplaceSync(
    platforms: Platform[],
    dependencies = { load: connectedMarketplace, fetchRows: fetchMarketplaceOrders },
) {
    await enqueueSync(platforms);
    const job = await claimSync(platforms);
    if (!job) return { processed: 0 };
    try {
        const { config, connection, tokens } = await dependencies.load(job.owner_id, job.platform);
        if (connection.connection_id !== job.connection_id) {
            await finishSyncFailure(job, null, true);
            return { processed: 1 };
        }
        const range = marketplaceRange(job.from_date, job.to_date),
            result = await dependencies.fetchRows(config, tokens, range, {
                shopCipher: job.shop_cipher || undefined,
            });
        if (result.rows === null) throw Error("Choose a shop before enabling sync.");
        if (!(await stageSync(job, result.rows))) await finishSyncFailure(job, null, true);
    } catch (error) {
        await finishSyncFailure(job, error);
    }
    return { processed: 1 };
}

export async function retryMarketplaceSync(owner: string, platform: Platform, id: string) {
    try {
        const result = await database().execute(
            sql`update seller_marketplace_sync_runs r set status='queued',attempts=0,available_at=now(),finished_at=null,error_message=null where r.owner_id=${owner} and r.platform=${platform} and r.id=${id}::uuid and r.status in ('failed','cancelled') and exists(select 1 from seller_marketplace_sync_settings s join seller_marketplace_connections c on c.owner_id=s.owner_id and c.platform=s.platform and c.connection_id=s.connection_id where s.owner_id=r.owner_id and s.platform=r.platform and s.enabled and s.connection_id=r.connection_id and s.shop_cipher is not distinct from r.shop_cipher) and not exists(select 1 from seller_marketplace_sync_runs a where a.owner_id=r.owner_id and a.platform=r.platform and a.status in ('queued','retrying','running')) returning r.id`,
        );
        return result.rows.length > 0;
    } catch (error) {
        if ((error as { cause?: { code?: string } }).cause?.code === "23505") return false;
        throw error;
    }
}

export async function disableMarketplaceSync(owner: string, platform: Platform) {
    await database().execute(
        sql`with targets as(select id from seller_marketplace_sync_runs where owner_id=${owner} and platform=${platform} and status in ('queued','retrying','running') for update), disabled as(update seller_marketplace_sync_settings set enabled=false,updated_at=now() where owner_id=${owner} and platform=${platform} and (select count(*) from targets)>=0 returning owner_id) update seller_marketplace_sync_runs set status='cancelled',finished_at=now(),lease_token=null,lease_until=null,error_message='Scheduled fetching was turned off.' where owner_id=${owner} and platform=${platform} and status in ('queued','retrying','running')`,
    );
}

export async function configureMarketplaceSync(
    owner: string,
    platform: Platform,
    preferences: { intervalMinutes: number; lookbackDays: number; shopCipher: string | null },
    fingerprint: string,
) {
    const result = await database()
        .execute(sql`with targets as(select id from seller_marketplace_sync_runs where owner_id=${owner} and platform=${platform} and status in ('queued','retrying','running') for update), saved as(
  insert into seller_marketplace_sync_settings(owner_id,platform,connection_id,enabled,interval_minutes,lookback_days,shop_cipher,next_run_at) select owner_id,platform,connection_id,true,${preferences.intervalMinutes},${preferences.lookbackDays},${preferences.shopCipher},now() from seller_marketplace_connections where owner_id=${owner} and platform=${platform} and app_fingerprint=${fingerprint} and (select count(*) from targets)>=0
  on conflict(owner_id,platform) do update set connection_id=excluded.connection_id,enabled=true,interval_minutes=excluded.interval_minutes,lookback_days=excluded.lookback_days,shop_cipher=excluded.shop_cipher,next_run_at=now(),updated_at=now() returning owner_id,platform,connection_id,shop_cipher
 ), cancelled as(update seller_marketplace_sync_runs r set status='cancelled',finished_at=now(),lease_token=null,lease_until=null,error_message='The scheduled shop changed.' from saved s where r.owner_id=s.owner_id and r.platform=s.platform and r.status in ('queued','retrying','running') and (r.connection_id<>s.connection_id or r.shop_cipher is distinct from s.shop_cipher)) select owner_id from saved`);
    return result.rows.length > 0;
}
