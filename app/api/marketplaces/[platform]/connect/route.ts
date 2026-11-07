import {
    routePlatform,
    marketplaceConnect,
    type MarketplaceContext,
} from "../../../../../lib/marketplace-routes";
import { json } from "../../../../../lib/api";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: MarketplaceContext) {
    const platform = await routePlatform(context);
    return platform
        ? marketplaceConnect(request, platform)
        : json({ error: "Unknown marketplace." }, 404);
}
