import { canonicalJson } from "./notebook-patch.mjs";
export const recordCollections = ["products", "expenses", "suppliers"];
export function parseRecordQuery(params) {
    const collection = params.get("collection"),
        id = params.get("id") || "",
        revision = params.get("revision");
    if (
        !recordCollections.includes(collection) ||
        id.length > 100 ||
        !revision ||
        !/^(0|[1-9]\d*)$/.test(revision) ||
        !Number.isSafeInteger(Number(revision))
    )
        throw Error("Invalid record lookup.");
    return { collection, id, revision: Number(revision) };
}
export function recordChanges(document, input) {
    if (
        !input ||
        Object.keys(input).some(
            (key) => !["revision", "collection", "id", "record", "expected"].includes(key),
        ) ||
        !recordCollections.includes(input.collection) ||
        typeof input.id !== "string" ||
        !input.id ||
        input.id.length > 100 ||
        !Number.isSafeInteger(input.revision) ||
        input.revision < 0 ||
        !Object.hasOwn(input, "expected") ||
        !Object.hasOwn(input, "record")
    )
        throw Error("Invalid record changes.");
    const { collection, id, record, expected } = input,
        rows = document[collection] || [],
        current = rows.find((item) => item.id === id) || null;
    if (canonicalJson(current) !== canonicalJson(expected))
        throw Error(
            collection === "suppliers"
                ? "This supplier changed on another device. Cancel and reopen the latest entry."
                : collection === "expenses"
                  ? "This expense changed or was removed on another device. Cancel this edit and reopen the latest entry."
                  : "This product changed or was removed. Reopen its latest entry.",
        );
    if (record === null) {
        if (!current || !["expenses", "suppliers"].includes(collection))
            throw Error("This record cannot be removed here.");
        return { [collection]: { remove: [id], upsert: [] } };
    }
    if (!record || typeof record !== "object" || Array.isArray(record) || record.id !== id)
        throw Error("Invalid record changes.");
    if (collection === "products") {
        if (current && record.stock !== current.stock)
            throw Error("Use Stock adjustments to change an existing product quantity.");
        if (
            rows.some(
                (item) =>
                    item.id !== id &&
                    typeof record.sku === "string" &&
                    item.sku.toLowerCase() === record.sku.toLowerCase(),
            )
        )
            throw Error("That SKU already exists. Use a unique SKU.");
    }
    if (collection === "suppliers") {
        const ids = new Set((document.products || []).map((product) => product.id));
        if (
            !Array.isArray(record.productIds) ||
            record.productIds.length > 3000 ||
            new Set(record.productIds).size !== record.productIds.length ||
            record.productIds.some((id) => !ids.has(id))
        )
            throw Error(
                "Some product links changed or are unavailable. Review the linked inventory items.",
            );
    }
    return {
        [collection]: {
            remove: [],
            upsert: [
                {
                    index: current
                        ? rows.findIndex((item) => item.id === id)
                        : collection === "expenses"
                          ? 0
                          : rows.length,
                    record,
                },
            ],
        },
    };
}
