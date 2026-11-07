export function resumeHash(value: string): string;
export function validDeletionRequest(value: unknown): boolean;
export function validResumeToken(value: unknown): boolean;
export function matchesResume(token: unknown, hash: unknown): boolean;
export function deletionConfig(env?: NodeJS.ProcessEnv): { key: string; base: string } | null;
export function ownsDeletionKey(owner: string, key: string): boolean;
