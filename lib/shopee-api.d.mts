export class ShopeeError extends Error {}
export type ShopeeConfig = {
    ready: boolean;
    missing: string[];
    environment: string;
    host?: string;
    partnerId?: string;
    partnerKey?: string;
    redirectUri?: string;
    encryptionKey?: Buffer;
};
export type Tokens = { accessToken: string; refreshToken: string; expiresAt: string };
export function shopeeConfig(env?: NodeJS.ProcessEnv): ShopeeConfig;
export function stateHash(state: string): string;
export function signShopee(
    partnerId: string,
    partnerKey: string,
    path: string,
    timestamp: number,
    accessToken?: string,
    shopId?: string,
): string;
export function sealTokens(tokens: Tokens, key: Buffer, ownerId: string, shopId: string): string;
export function openTokens(encoded: string, key: Buffer, ownerId: string, shopId: string): Tokens;
export function authorizationUrl(config: ShopeeConfig, state: string, now?: number): string;
export function exchangeCode(
    config: ShopeeConfig,
    code: string,
    shopId: string,
    fetcher?: typeof fetch,
): Promise<Tokens>;
export function refreshTokens(
    config: ShopeeConfig,
    refreshToken: string,
    shopId: string,
    fetcher?: typeof fetch,
): Promise<Tokens>;
export function orderRows(details: unknown[]): Record<string, string>[];
export function fetchOrderRows(
    config: ShopeeConfig,
    accessToken: string,
    shopId: string,
    from: number,
    to: number,
    fetcher?: typeof fetch,
): Promise<Record<string, string>[]>;
