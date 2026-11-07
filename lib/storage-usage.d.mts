export type StorageUsage = {
    usedBytes: number;
    attachmentBytes: number;
    profileBytes: number;
    pendingBytes: number;
};
export const GIB: number;
export function storageUsage(
    attachmentBytes: number,
    profileBytes?: number,
    pendingBytes?: number,
): StorageUsage;
export function formatStorage(bytes: number): string;
