import type { CloudNotebook } from "./use-notebook-view";
import { downloadNotebookFile } from "./download-notebook";
export function viewUrl(
    cloud: CloudNotebook,
    kind: string,
    filters: Record<string, string> = {},
    format = "csv",
) {
    return (
        "/api/notebook/view-export?" +
        new URLSearchParams({ kind, revision: String(cloud.revision), ...filters, format })
    );
}
export async function downloadView(
    cloud: CloudNotebook,
    kind: string,
    filters: Record<string, string> = {},
    format = "csv",
) {
    await downloadNotebookFile(viewUrl(cloud, kind, filters, format), cloud.userId);
}
