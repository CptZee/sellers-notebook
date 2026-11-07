import type { CloudNotebook } from "./use-notebook-view";
import { downloadNotebookFile } from "./download-notebook";
export function recordCopyUrl(cloud: CloudNotebook, kind: "customer" | "purchase", id: string) {
    return (
        "/api/notebook/copy?" + new URLSearchParams({ kind, id, revision: String(cloud.revision) })
    );
}
export async function downloadRecordCopy(
    cloud: CloudNotebook,
    kind: "customer" | "purchase",
    id: string,
) {
    return downloadNotebookFile(recordCopyUrl(cloud, kind, id), cloud.userId);
}
/** Open synchronously so the browser associates the popup with the user's click. */
export async function printRecordCopy(
    cloud: CloudNotebook,
    kind: "customer" | "purchase",
    id: string,
) {
    const popup = window.open("", "_blank", "width=1000,height=750");
    if (!popup)
        throw Error(
            kind === "customer"
                ? "Allow the order-summary window to open, or download the customer copy instead."
                : "Allow the purchase window to open, or download the supplier copy instead.",
        );
    popup.opener = null;
    try {
        const response = await fetch(recordCopyUrl(cloud, kind, id), {
            cache: "no-store",
            headers: { "X-Notebook-User": cloud.userId },
        });
        if (!response.ok)
            throw Error((await response.json()).error || "Could not prepare this copy.");
        const body = await response.text();
        if (popup.closed) throw Error("The copy window was closed. Open it again to print.");
        popup.document.write(body);
        popup.document.close();
        popup.focus();
        popup.print();
    } catch (error) {
        popup.close();
        throw error;
    }
}
