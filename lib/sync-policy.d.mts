export function syncConfigured(env?: NodeJS.ProcessEnv): boolean;
export function authorizedSyncWorker(header: unknown, env?: NodeJS.ProcessEnv): boolean;
export function syncPreferences(value: unknown): {
    enabled: boolean;
    intervalMinutes: number;
    lookbackDays: number;
    shopCipher: string | null;
};
export function syncFailure(
    error: unknown,
    attempt: number,
): { retry: boolean; delaySeconds: number; message: string };
