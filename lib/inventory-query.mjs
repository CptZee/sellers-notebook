import { pageSizes } from "./pagination.mjs";
export function parseInventoryQuery(params) {
    const page = params.get("page") || "1",
        size = params.get("size") || "25",
        revision = params.get("revision"),
        search = params.get("search") || "";
    if (
        ![page, size, revision].every(
            (value) =>
                typeof value === "string" &&
                /^(0|[1-9]\d*)$/.test(value) &&
                Number.isSafeInteger(Number(value)),
        ) ||
        Number(page) < 1 ||
        Number(page) > 10000 ||
        !pageSizes.includes(Number(size)) ||
        search.length > 200
    )
        throw Error("Invalid inventory filters.");
    return { page: Number(page), size: Number(size), revision: Number(revision), search };
}
