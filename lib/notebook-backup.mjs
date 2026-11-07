import { validDocument } from "./notebook-validation.mjs";
export function normalizeBackupDocument(document) {
    return {
        products: document.products,
        orders: document.orders,
        expenses: document.expenses || [],
        sidebarNote: document.sidebarNote || "",
        branding: document.branding || null,
        stockAdjustments: document.stockAdjustments || [],
        refundRecords: document.refundRecords || [],
        suppliers: document.suppliers || [],
        purchaseOrders: document.purchaseOrders || [],
    };
}
export function backupFingerprint(document) {
    return JSON.stringify(normalizeBackupDocument(document), (_key, value) =>
        value && typeof value === "object" && !Array.isArray(value)
            ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
            : value,
    );
}
export function createNotebookBackup(document, now = new Date()) {
    if (!validDocument(document))
        throw Error("This notebook cannot be backed up yet. Reload and try again.");
    return JSON.stringify(
        {
            format: "sellers-notebook",
            version: 1,
            exportedAt: now.toISOString(),
            document: normalizeBackupDocument(document),
        },
        null,
        2,
    );
}
export function readNotebookBackup(text) {
    if (new TextEncoder().encode(text).length > 8 * 1024 * 1024)
        throw Error("Choose a notebook backup up to 8 MB.");
    let backup;
    try {
        backup = JSON.parse(text.replace(/^\uFEFF/, ""));
    } catch {
        throw Error("Choose a valid JSON notebook backup.");
    }
    if (
        !backup ||
        backup.format !== "sellers-notebook" ||
        backup.version !== 1 ||
        typeof backup.exportedAt !== "string" ||
        !Number.isFinite(Date.parse(backup.exportedAt)) ||
        !validDocument(backup.document)
    )
        throw Error("This is not a supported Seller’s Notebook backup, or its data is invalid.");
    const document = normalizeBackupDocument(backup.document);
    if (
        new TextEncoder().encode(JSON.stringify({ revision: 999999999999999, document })).length >
        4000000
    )
        throw Error("This backup is too large for the notebook save limit.");
    return { exportedAt: backup.exportedAt, document };
}
