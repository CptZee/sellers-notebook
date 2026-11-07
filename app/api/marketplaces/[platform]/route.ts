import {
    routePlatform,
    marketplaceStatus,
    marketplaceDisconnect,
    type MarketplaceContext,
} from "../../../../lib/marketplace-routes";
import { json } from "../../../../lib/api";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: MarketplaceContext) {
    const platform = await routePlatform(context);
    return platform
        ? marketplaceStatus(request, platform)
        : json({ error: "Unknown marketplace." }, 404);
}
export async function DELETE(request: Request, context: MarketplaceContext) {
    const platform = await routePlatform(context);
    return platform
        ? marketplaceDisconnect(request, platform)
        : json({ error: "Unknown marketplace." }, 404);
}
