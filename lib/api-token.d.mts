export function hashApiToken(token: string): string;
export function createApiToken(): string;
export function readApiBody(request: Request, limit?: number): Promise<Uint8Array<ArrayBuffer>>;
export function bearerToken(header: string | null): string | null;
export function keyInput(body: unknown): { name: string; purpose: string; scope: string };
