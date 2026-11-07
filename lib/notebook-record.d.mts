export const recordCollections: string[];
export function parseRecordQuery(params: URLSearchParams): {
    collection: string;
    id: string;
    revision: number;
};
export function recordChanges(
    document: Record<string, unknown>,
    input: unknown,
): Record<string, { remove: string[]; upsert: { index: number; record: unknown }[] }>;
