export function encodeAttachmentCursor(row) {
    return Buffer.from(JSON.stringify({ date: row.created_at, id: row.id })).toString("base64url");
}
export function decodeAttachmentCursor(value) {
    if (!value) return null;
    try {
        if (value.length > 512) throw Error();
        const cursor = JSON.parse(Buffer.from(value, "base64url").toString());
        if (
            typeof cursor.date !== "string" ||
            cursor.date.length > 50 ||
            !/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}(?::?\d{2})?)$/.test(
                cursor.date,
            ) ||
            !Number.isFinite(
                Date.parse(cursor.date.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00")),
            ) ||
            Number(cursor.date.slice(0, 4)) < 1 ||
            new Date(cursor.date.slice(0, 10) + "T12:00:00Z").toISOString().slice(0, 10) !==
                cursor.date.slice(0, 10) ||
            typeof cursor.id !== "string" ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cursor.id)
        )
            throw Error();
        return cursor;
    } catch {
        throw Error("Invalid file-page cursor.");
    }
}
