export const GIB = 1024 ** 3;

/** Track file usage without imposing an account-level storage allowance. */
export function storageUsage(attachmentBytes, profileBytes = 0, pendingBytes = 0) {
    for (const bytes of [attachmentBytes, profileBytes, pendingBytes]) {
        if (!Number.isSafeInteger(bytes) || bytes < 0) throw Error("Invalid storage usage.");
    }
    const usedBytes = attachmentBytes + profileBytes + pendingBytes;
    if (!Number.isSafeInteger(usedBytes)) throw Error("Invalid storage usage.");
    return { usedBytes, attachmentBytes, profileBytes, pendingBytes };
}

export function formatStorage(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return "—";
    if (bytes === 0) return "0 MB";
    if (bytes < GIB) {
        return `${Math.max(0.01, bytes / 1024 ** 2).toLocaleString("en-PH", { maximumFractionDigits: 2 })} MB`;
    }
    return `${(bytes / GIB).toLocaleString("en-PH", { maximumFractionDigits: 2 })} GB`;
}
