import type { MarketplaceConfig, MarketplaceTokens, Platform } from "./marketplace-api.mjs";
export class MarketplaceError extends Error {}
export function marketplaceImportEnabled(platform: Platform, env?: NodeJS.ProcessEnv): boolean;
export function signTikTok(
    path: string,
    params: Record<string, string>,
    body: string,
    secret: string,
): string;
export function marketplaceRange(
    from: unknown,
    to: unknown,
    now?: number,
): { from: number; to: number };
export function refreshMarketplaceTokens(
    config: MarketplaceConfig,
    tokens: MarketplaceTokens,
    options?: { fetcher?: typeof fetch; now?: number },
): Promise<MarketplaceTokens>;
export function marketplaceOrderRows(
    platform: Platform,
    orders: unknown[],
): Record<string, string>[];
export function fetchMarketplaceOrders(
    config: MarketplaceConfig,
    tokens: MarketplaceTokens,
    range: { from: number; to: number },
    options?: { fetcher?: typeof fetch; now?: number; shopCipher?: string },
): Promise<{
    rows: Record<string, string>[] | null;
    shops?: { id: string; name: string; cipher: string }[];
    shopId?: string;
}>;
