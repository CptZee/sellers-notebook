import {
    retryMarketplaceSync,
    disableMarketplaceSync,
    configureMarketplaceSync,
} from "../../../../../lib/marketplace-sync";
import { sql } from "drizzle-orm";
import { database } from "../../../../../lib/db";
import { sessionUser, json, sameOrigin } from "../../../../../lib/api";
import { routePlatform, type MarketplaceContext } from "../../../../../lib/marketplace-routes";
import { marketplaceConfig, type Platform } from "../../../../../lib/marketplace-api.mjs";
import { marketplaceImportEnabled } from "../../../../../lib/marketplace-orders.mjs";
import { syncConfigured, syncPreferences } from "../../../../../lib/sync-policy.mjs";
const available = (p: Platform) =>
    syncConfigured() && marketplaceConfig(p).ready && marketplaceImportEnabled(p);
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: MarketplaceContext) {
    try {
        const platform = await routePlatform(context);
        if (!platform) return json({ error: "Unknown marketplace." }, 404);
        const user = await sessionUser(request);
        if (!user) return json({ error: "Sign in to view sync history." }, 401);
        const params = new URL(request.url).searchParams,
            run = params.get("run"),
            page = Number(params.get("page") || 1);
        if (
            (run && !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(run)) ||
            !Number.isSafeInteger(page) ||
            page < 1 ||
            page > 10000
        )
            return json({ error: "Invalid sync lookup." }, 400);
        if (run) {
            const result = await database().execute(
                sql`select r.id,c.account_id as "shopId",coalesce((select jsonb_agg(jsonb_build_object('Order ID',source_order_id,'Seller SKU',sku,'Quantity',quantity::text,'Unit Price',to_char(unit_price,'FM999999999990.00'),'Order Date',ordered_on::text,'Order Status',status,'Buyer Username',buyer,'Currency',currency) order by position) from seller_marketplace_sync_rows where owner_id=r.owner_id and run_id=r.id),'[]'::jsonb) rows from seller_marketplace_sync_runs r join seller_marketplace_connections c on c.owner_id=r.owner_id and c.platform=r.platform and c.connection_id=r.connection_id where r.owner_id=${user.id} and r.platform=${platform} and r.id=${run}::uuid and r.status='ready'`,
            );
            if (!result.rows[0])
                return json(
                    { error: "This batch is unavailable or its shop was disconnected." },
                    404,
                );
            return json({
                ...result.rows[0],
                platform: platform === "lazada" ? "Lazada" : "TikTok Shop",
            });
        }
        const result = await database().execute(
            sql`select (select jsonb_build_object('enabled',s.enabled and exists(select 1 from seller_marketplace_connections c where c.owner_id=s.owner_id and c.platform=s.platform and c.connection_id=s.connection_id),'intervalMinutes',s.interval_minutes,'lookbackDays',s.lookback_days,'shopCipher',s.shop_cipher,'nextRunAt',s.next_run_at) from seller_marketplace_sync_settings s where owner_id=${user.id} and platform=${platform}) settings,(select count(*)::int from seller_marketplace_sync_runs where owner_id=${user.id} and platform=${platform}) total,coalesce((select jsonb_agg(value order by created_at desc,id desc) from (select id,created_at,jsonb_build_object('id',id,'status',status,'attempts',attempts,'from',from_date,'to',to_date,'rows',rows_count,'error',error_message,'createdAt',created_at,'finishedAt',finished_at) value from seller_marketplace_sync_runs where owner_id=${user.id} and platform=${platform} order by created_at desc,id desc limit 25 offset ${(page - 1) * 25}) p),'[]'::jsonb) runs`,
        );
        return json({ ...result.rows[0], available: available(platform), page, pageSize: 25 });
    } catch {
        return json({ error: "Sync history is temporarily unavailable." }, 503);
    }
}
export async function POST(request: Request, context: MarketplaceContext) {
    try {
        const platform = await routePlatform(context);
        if (!platform) return json({ error: "Unknown marketplace." }, 404);
        const user = await sessionUser(request);
        if (!user) return json({ error: "Sign in to manage sync." }, 401);
        if (!sameOrigin(request)) return json({ error: "Cross-origin write rejected." }, 403);
        const raw = await request.text();
        if (raw.length > 2000) return json({ error: "Invalid settings." }, 413);
        let body;
        try {
            body = JSON.parse(raw);
        } catch {
            return json({ error: "Invalid sync settings." }, 400);
        }
        if (body?.action === "retry") {
            if (!available(platform))
                return json(
                    { error: "Scheduled fetching is coming soon. CSV imports remain available." },
                    503,
                );
            if (
                Object.keys(body).some((k) => !["action", "id"].includes(k)) ||
                typeof body.id !== "string" ||
                !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(body.id)
            )
                return json({ error: "Invalid run." }, 400);
            const queued = await retryMarketplaceSync(user.id, platform, body.id);
            return queued
                ? json({ queued: true })
                : json(
                      {
                          error: "This run cannot be retried. Check the current connection and enabled schedule.",
                      },
                      409,
                  );
        }
        let preferences;
        try {
            preferences = syncPreferences(body);
            if (body.action !== "configure") throw Error();
        } catch {
            return json({ error: "Choose valid sync settings." }, 400);
        }
        if (!preferences.enabled) {
            await disableMarketplaceSync(user.id, platform);
            return json({ enabled: false });
        }
        if (!available(platform))
            return json(
                { error: "Scheduled fetching is coming soon. CSV imports remain available." },
                503,
            );
        const saved = await configureMarketplaceSync(
            user.id,
            platform,
            preferences,
            marketplaceConfig(platform).fingerprint!,
        );
        return saved
            ? json({ enabled: true })
            : json({ error: "Connect your own shop before enabling a schedule." }, 409);
    } catch {
        return json({ error: "Sync settings could not be saved. Please retry." }, 503);
    }
}
