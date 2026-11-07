import { json } from "../../../../lib/api";
import { authorizedSyncWorker } from "../../../../lib/sync-policy.mjs";
import { marketplaceConfig, type Platform } from "../../../../lib/marketplace-api.mjs";
import { marketplaceImportEnabled } from "../../../../lib/marketplace-orders.mjs";
import { workMarketplaceSync } from "../../../../lib/marketplace-sync";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
export async function POST(request: Request) {
    if (!authorizedSyncWorker(request.headers.get("authorization")))
        return json({ error: "Worker unavailable or unauthorized." }, 401);
    const platforms = (["lazada", "tiktok"] as Platform[]).filter(
        (p) => marketplaceConfig(p).ready && marketplaceImportEnabled(p),
    );
    if (!platforms.length) return json({ processed: 0 });
    try {
        return json(await workMarketplaceSync(platforms));
    } catch {
        return json({ error: "The sync worker could not complete. Retry later." }, 503);
    }
}
