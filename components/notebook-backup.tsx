"use client";
import { downloadNotebookFile } from "../lib/download-notebook";
import { confirmAction } from "./confirm-dialog";
import { useState } from "react";
import {
    createNotebookBackup,
    readNotebookBackup,
    backupFingerprint,
} from "../lib/notebook-backup.mjs";
import type { NotebookSnapshot } from "../lib/notebook-types";
export function NotebookBackup({
    document,
    onRestore,
    disabled,
    cloud,
}: {
    cloud?: { userId: string; revision: number };
    document: NotebookSnapshot;
    onRestore: (document: NotebookSnapshot) => void;
    disabled: boolean;
}) {
    const [backup, setBackup] = useState<ReturnType<typeof readNotebookBackup> | null>(null),
        [checkpoint, setCheckpoint] = useState(""),
        [reviewed, setReviewed] = useState(false),
        [error, setError] = useState(""),
        [message, setMessage] = useState(""),
        [downloading, setDownloading] = useState(false);
    const current = cloud ? "revision:" + cloud.revision : backupFingerprint(document),
        fresh = checkpoint === current;
    async function download() {
        setError("");
        setDownloading(true);
        try {
            if (cloud) {
                await downloadNotebookFile(
                    "/api/notebook/backup?revision=" + cloud.revision,
                    cloud.userId,
                );
                setCheckpoint(current);
                setMessage(
                    "Current notebook backup download started. Keep the file before restoring.",
                );
                return;
            }
            const url = URL.createObjectURL(
                new Blob([createNotebookBackup(document)], { type: "application/json" }),
            );
            const link = window.document.createElement("a");
            link.href = url;
            link.download = `sellers-notebook-backup-${new Date().toISOString().replaceAll(":", "-")}.json`;
            link.click();
            URL.revokeObjectURL(url);
            setCheckpoint(current);
            setMessage("Current notebook backup download started. Keep the file before restoring.");
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not create a backup.");
        } finally {
            setDownloading(false);
        }
    }
    return (
        <details className="notebook-backup">
            <summary>Backup &amp; restore</summary>
            <p className="settings-intro">
                Download your products, orders, expenses, stock-adjustment history, refund records,
                suppliers, purchase orders, notes, and branding. Files, profile pictures, sign-in
                details, and marketplace connections are stored separately and are not included.
                Keep this file private.
            </p>
            <button
                className="button secondary"
                type="button"
                disabled={disabled || downloading}
                onClick={download}
            >
                Download notebook backup
            </button>
            <label className="button secondary upload-button">
                Choose backup to restore
                <input
                    type="file"
                    aria-label="Choose notebook backup"
                    accept=".json,application/json"
                    disabled={disabled}
                    onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        setError("");
                        setMessage("");
                        setBackup(null);
                        setReviewed(false);
                        setCheckpoint("");
                        try {
                            if (file.size > 8 * 1024 * 1024)
                                throw Error("Choose a notebook backup up to 8 MB.");
                            setBackup(readNotebookBackup(await file.text()));
                        } catch (e) {
                            setError(
                                e instanceof Error ? e.message : "Could not read this backup.",
                            );
                        }
                    }}
                />
            </label>
            {backup && (
                <div className="backup-preview">
                    <h3>Review backup</h3>
                    <p>Exported {new Date(backup.exportedAt).toLocaleString("en-PH")}</p>
                    <ul>
                        <li>{backup.document.products.length} products</li>
                        <li>{backup.document.orders.length} order lines</li>
                        <li>{backup.document.expenses.length} expenses</li>
                        <li>{backup.document.suppliers.length} suppliers</li>
                        <li>{backup.document.purchaseOrders.length} purchase orders</li>
                        <li>
                            {backup.document.purchaseOrders.reduce(
                                (total, order) => total + (order.payments?.length || 0),
                                0,
                            )}{" "}
                            purchase payments
                        </li>
                        <li>
                            {backup.document.purchaseOrders.reduce(
                                (total, order) => total + (order.goodsReturns?.length || 0),
                                0,
                            )}{" "}
                            supplier goods returns (including voided entries)
                        </li>
                        <li>
                            {backup.document.purchaseOrders.reduce(
                                (total, order) =>
                                    total +
                                    (order.supplierRefunds?.length || 0) +
                                    (order.goodsReturnRefunds?.length || 0),
                                0,
                            )}{" "}
                            supplier cash refund records
                        </li>
                        <li>{backup.document.stockAdjustments.length} stock adjustments</li>
                        <li>{backup.document.refundRecords.length} refund records</li>
                    </ul>
                    <p>
                        Restoring replaces the current notebook records, stock quantities, note, and
                        branding. Existing cloud files stay stored; product links refer to the
                        restored product IDs.
                    </p>
                    <p>
                        {fresh
                            ? "Current backup download started. Check that the file is saved before continuing."
                            : "Download the current notebook backup before continuing."}
                    </p>
                    <label className="import-confirm">
                        <input
                            type="checkbox"
                            checked={reviewed}
                            onChange={(e) => setReviewed(e.target.checked)}
                        />
                        I understand this replaces my current notebook data.
                    </label>
                    <button
                        className="button secondary cancel"
                        type="button"
                        disabled={disabled || !fresh || !reviewed}
                        onClick={async () => {
                            setError("");
                            if (
                                !(await confirmAction(
                                    "Replace this notebook with the reviewed backup? Keep your current backup so you can undo this later.",
                                ))
                            )
                                return;
                            try {
                                if (
                                    checkpoint !==
                                    (cloud
                                        ? "revision:" + cloud.revision
                                        : backupFingerprint(document))
                                )
                                    throw Error(
                                        "The notebook changed. Download a fresh current backup before restoring.",
                                    );
                                onRestore(backup.document);
                                setBackup(null);
                                setReviewed(false);
                                setCheckpoint("");
                                setMessage(
                                    "Backup applied. Wait for Saved to your account before closing.",
                                );
                            } catch (e) {
                                setError(
                                    e instanceof Error
                                        ? e.message
                                        : "Could not restore this backup.",
                                );
                            }
                        }}
                    >
                        Restore reviewed backup
                    </button>
                </div>
            )}
            {error && (
                <p
                    className="auth-error"
                    role="alert"
                >
                    {error}
                </p>
            )}
            {message && (
                <p
                    className="auth-message"
                    role="status"
                >
                    {message}
                </p>
            )}
        </details>
    );
}
