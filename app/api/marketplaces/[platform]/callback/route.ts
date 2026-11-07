import {
    routePlatform,
    marketplaceCallback,
    type MarketplaceContext,
} from "../../../../../lib/marketplace-routes";
import { json } from "../../../../../lib/api";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: MarketplaceContext) {
    const platform = await routePlatform(context);
    return platform
        ? marketplaceCallback(request, platform)
        : json({ error: "Unknown marketplace." }, 404);
}
