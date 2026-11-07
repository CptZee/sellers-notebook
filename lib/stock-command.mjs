import { canonicalJson } from "./notebook-patch.mjs";
import { stockChange } from "./stock-adjustments.mjs";
export function stockCommand(document, command) {
    if (
        !command ||
        Object.keys(command).some((k) => !["id", "expected", "input", "revision"].includes(k)) ||
        typeof command.id !== "string" ||
        !command.id.trim() ||
        command.id.length > 100
    )
        throw Error("Invalid stock command.");
    const products = document.products || [],
        history = document.stockAdjustments || [],
        index = products.findIndex((p) => p.id === command.expected?.id),
        product = products[index];
    if (!product || canonicalJson(product) !== canonicalJson(command.expected))
        throw Error("This product changed. Select it again to review its latest stock.");
    if (history.some((row) => row.id === command.id))
        throw Error("This adjustment was already recorded.");
    if (history.length >= 10000)
        throw Error("The adjustment history has reached its 10,000-entry limit.");
    const input = command.input;
    if (!input || Object.keys(input).some((k) => !["kind", "quantity", "reason"].includes(k)))
        throw Error("Invalid stock adjustment.");
    const change = {
        ...stockChange(product, input.kind, input.quantity, input.reason),
        id: command.id,
    };
    return {
        products: { remove: [], upsert: [{ index, record: { ...product, stock: change.after } }] },
        stockAdjustments: { remove: [], upsert: [{ index: 0, record: change }] },
    };
}
