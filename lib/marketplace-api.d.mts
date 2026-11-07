export type Platform = "lazada" | "tiktok";
export type MarketplaceConfig = {
    ready: boolean;
    platform: Platform;
    appKey?: string;
    appSecret?: string;
    redirectUri?: string;
    serviceId?: string;
    encryptionKey?: Buffer;
    fingerprint?: string;
};
export type MarketplaceTokens = {
    accountId: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
};
export const platforms: Platform[];
export function platformName(p: Platform): string;
export function marketplaceConfig(platform: Platform, env?: NodeJS.ProcessEnv): MarketplaceConfig;
export function marketplaceAuthorizationUrl(config: MarketplaceConfig, state: string): string;
export function signLazada(path: string, params: Record<string, string>, secret: string): string;
export function encryptMarketplaceTokens(
    tokens: MarketplaceTokens,
    key: Buffer,
    owner: string,
    platform: Platform,
    account: string,
): string;
export function decryptMarketplaceTokens(
    value: string,
    key: Buffer,
    owner: string,
    platform: Platform,
    account: string,
): MarketplaceTokens;
export function normalizeMarketplaceTokens(
    platform: Platform,
    result: unknown,
    now?: number,
): MarketplaceTokens;
export function exchangeMarketplaceCode(
    config: MarketplaceConfig,
    code: string,
    options?: { fetcher?: typeof fetch; now?: number },
): Promise<MarketplaceTokens>;
