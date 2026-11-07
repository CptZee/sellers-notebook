export function encodeAttachmentCursor(row: { created_at: string; id: string }): string;
export function decodeAttachmentCursor(value: string | null): { date: string; id: string } | null;
