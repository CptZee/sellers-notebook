import { notebookCollections } from "./notebook-pages.mjs";
export const canonicalJson = (value) =>
    JSON.stringify(value, (_key, item) =>
        item && typeof item === "object" && !Array.isArray(item)
            ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
            : item,
    );
const metadata = ["sidebarNote", "branding"];
export function createNotebookPatch(before, after) {
    const changes = {};
    for (const key of Object.keys(notebookCollections)) {
        const previous = before[key] || [],
            next = after[key] || [],
            old = new Map(previous.map((record) => [record.id, record])),
            ids = new Set(next.map((record) => record.id));
        const remove = previous.filter((record) => !ids.has(record.id)).map((record) => record.id);
        const upsert = next.flatMap((record, index) =>
            !old.has(record.id) || canonicalJson(old.get(record.id)) !== canonicalJson(record)
                ? [{ index, record }]
                : [],
        );
        if (
            !remove.length &&
            !upsert.length &&
            previous.every((record, index) => record.id === next[index]?.id)
        )
            continue;
        const provisional = previous
            .filter((record) => ids.has(record.id))
            .map((record) => record.id);
        for (const { index, record } of upsert)
            if (!old.has(record.id)) provisional.splice(index, 0, record.id);
        changes[key] = {
            remove,
            upsert,
            ...(provisional.some((id, index) => id !== next[index]?.id)
                ? { order: next.map((record) => record.id) }
                : {}),
        };
    }
    for (const key of metadata)
        if (canonicalJson(before[key]) !== canonicalJson(after[key])) changes[key] = after[key];
    return changes;
}
export function applyNotebookPatch(document, changes) {
    if (
        !changes ||
        typeof changes !== "object" ||
        Array.isArray(changes) ||
        !Object.keys(changes).length ||
        Object.keys(changes).some(
            (key) => !Object.hasOwn(notebookCollections, key) && !metadata.includes(key),
        )
    )
        throw Error("Invalid notebook changes.");
    const result = { ...document };
    for (const [key, change] of Object.entries(changes)) {
        if (metadata.includes(key)) {
            result[key] = change;
            continue;
        }
        if (
            !change ||
            typeof change !== "object" ||
            Array.isArray(change) ||
            Object.keys(change).some((key) => !["remove", "upsert", "order"].includes(key)) ||
            !Array.isArray(change.remove) ||
            !Array.isArray(change.upsert) ||
            change.remove.length > notebookCollections[key] ||
            change.upsert.length > notebookCollections[key]
        )
            throw Error("Invalid record changes.");
        const original = document[key] || [],
            existing = new Set(original.map((record) => record.id)),
            seen = new Set();
        for (const id of change.remove) {
            if (typeof id !== "string" || !existing.has(id) || seen.has(id))
                throw Error("Invalid removed record.");
            seen.add(id);
        }
        const removed = new Set(change.remove),
            updates = new Map();
        for (const entry of change.upsert) {
            const id = entry?.record?.id;
            if (
                !entry ||
                !Number.isSafeInteger(entry.index) ||
                entry.index < 0 ||
                entry.index >= notebookCollections[key] ||
                !entry.record ||
                typeof entry.record !== "object" ||
                Array.isArray(entry.record) ||
                typeof id !== "string" ||
                !id.length ||
                id.length > 100 ||
                seen.has(id)
            )
                throw Error("Invalid changed record.");
            seen.add(id);
            updates.set(id, entry.record);
        }
        const records = original
            .filter((record) => !removed.has(record.id))
            .map((record) => updates.get(record.id) || record);
        for (const entry of change.upsert
            .filter((entry) => !existing.has(entry.record.id))
            .toSorted((a, b) => a.index - b.index)) {
            if (entry.index > records.length) throw Error("Invalid record position.");
            records.splice(entry.index, 0, entry.record);
        }
        if (records.length > notebookCollections[key]) throw Error("Record limit exceeded.");
        if (change.order !== undefined) {
            if (
                !Array.isArray(change.order) ||
                change.order.length !== records.length ||
                new Set(change.order).size !== records.length
            )
                throw Error("Invalid record order.");
            const byId = new Map(records.map((record) => [record.id, record]));
            if (change.order.some((id) => !byId.has(id))) throw Error("Invalid record order.");
            result[key] = change.order.map((id) => byId.get(id));
        } else result[key] = records;
    }
    return result;
}
