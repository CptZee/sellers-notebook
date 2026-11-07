import type { NotebookSnapshot } from "./notebook-types";
export function normalizeBackupDocument(
    document: Partial<NotebookSnapshot> & Pick<NotebookSnapshot, "products" | "orders">,
): NotebookSnapshot;
export function backupFingerprint(document: NotebookSnapshot): string;
export function createNotebookBackup(document: NotebookSnapshot, now?: Date): string;
export function readNotebookBackup(text: string): {
    exportedAt: string;
    document: NotebookSnapshot;
};
