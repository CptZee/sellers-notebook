export async function downloadNotebookFile(url: string, userId: string) {
    const response = await fetch(url, {
        cache: "no-store",
        headers: { "X-Notebook-User": userId },
    });
    if (!response.ok) {
        const body = await response.json();
        throw Error(body.error || "This download could not be created.");
    }
    const blob = await response.blob(),
        objectUrl = URL.createObjectURL(blob),
        link = document.createElement("a");
    link.href = objectUrl;
    link.download =
        /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") || "")?.[1] ||
        "notebook-download";
    link.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    return response.headers.get("X-Notebook-Revision");
}
