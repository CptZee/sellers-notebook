import { readShopeeCsv } from "./shopee-import.mjs";
export const inventoryFields = [
    {
        key: "name",
        label: "Product name",
        required: true,
        aliases: ["product name", "name", "product", "item name"],
    },
    { key: "sku", label: "SKU", required: true, aliases: ["sku", "seller sku", "seller_sku"] },
    {
        key: "cost",
        label: "Unit cost (PHP)",
        required: true,
        aliases: ["unit cost", "cost", "unit_cost"],
    },
    {
        key: "price",
        label: "Selling price (PHP)",
        required: true,
        aliases: ["selling price", "price", "unit price"],
    },
    {
        key: "stock",
        label: "Current stock",
        required: true,
        aliases: ["stock", "current stock", "stock quantity", "quantity"],
    },
    {
        key: "category",
        label: "Category (optional)",
        required: false,
        aliases: ["category", "product category"],
    },
    {
        key: "reorderPoint",
        label: "Reorder point (optional)",
        required: false,
        aliases: ["reorder point", "alert at", "low stock threshold"],
    },
    {
        key: "targetStock",
        label: "Target stock (optional)",
        required: false,
        aliases: ["target stock", "restock target"],
    },
    { key: "currency", label: "Currency (optional)", required: false, aliases: ["currency"] },
];
export function readInventoryCsv(text) {
    const data = readShopeeCsv(text);
    return {
        ...data,
        mapping: Object.fromEntries(
            inventoryFields.map((field) => [
                field.key,
                data.headers.find((header) => field.aliases.includes(header.toLowerCase())) || "",
            ]),
        ),
    };
}
function money(text) {
    const value = text.replace(/^(PHP|₱)\s*/i, "");
    if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(value)) return NaN;
    return Number(value.replaceAll(",", ""));
}
export function previewInventoryImport(rows, mapping, existing) {
    const products = [],
        errors = [],
        seen = new Set(),
        known = new Set(existing.map((p) => p.sku.trim().toLowerCase()));
    let duplicates = 0;
    for (const field of inventoryFields)
        if (field.required && !mapping[field.key])
            errors.push({ row: 0, message: `Choose the ${field.label} column.` });
    if (rows.length > 1000)
        errors.push({ row: 0, message: "Import up to 1,000 products at a time." });
    if (errors.length) return { products, errors, duplicates };
    for (let index = 0; index < rows.length; index++) {
        const get = (key) => String(rows[index][mapping[key]] ?? "").trim(),
            row = index + 2;
        const name = get("name"),
            sku = get("sku"),
            category = get("category") || "General",
            cost = money(get("cost")),
            price = money(get("price")),
            stockText = get("stock"),
            stock = Number(stockText);
        if (!sku || sku.length > 100) {
            errors.push({ row, message: "Use a SKU of 1–100 characters." });
            continue;
        }
        const key = sku.toLowerCase();
        if (seen.has(key)) {
            errors.push({
                row,
                message: `SKU “${sku}” occurs twice in this file. Resolve the duplicate first.`,
            });
            continue;
        }
        seen.add(key);
        if (known.has(key)) {
            duplicates++;
            continue;
        }
        const problem =
            !name || name.length > 200
                ? "Use a product name of 1–200 characters."
                : category.length > 200
                  ? "Use a category of up to 200 characters."
                  : ![cost, price].every((n) => Number.isFinite(n) && n >= 0 && n <= 100000000)
                    ? "Use nonnegative unit cost and selling price with up to two decimals."
                    : !/^\d+$/.test(stockText) ||
                        !Number.isSafeInteger(stock) ||
                        stock < 0 ||
                        stock > 10000000
                      ? "Use a whole stock quantity from 0 to 10,000,000."
                      : get("currency") && get("currency").toUpperCase() !== "PHP"
                        ? "This notebook supports PHP inventory only."
                        : null;
        if (problem) {
            errors.push({ row, message: problem });
            continue;
        }
        const pointText = get("reorderPoint"),
            targetText = get("targetStock");
        const reorderPoint = pointText ? (/^\d+$/.test(pointText) ? Number(pointText) : NaN) : 10;
        const targetStock = targetText
            ? /^\d+$/.test(targetText)
                ? Number(targetText)
                : NaN
            : Math.max(20, reorderPoint + 1);
        if (
            !Number.isSafeInteger(reorderPoint) ||
            reorderPoint < 0 ||
            reorderPoint >= 10000000 ||
            !Number.isSafeInteger(targetStock) ||
            targetStock <= reorderPoint ||
            targetStock > 10000000
        ) {
            errors.push({
                row,
                message:
                    "Use whole alert/target levels; target must be above the alert, up to 10,000,000.",
            });
            continue;
        }

        products.push({
            id: crypto.randomUUID(),
            name,
            sku,
            category,
            cost,
            price,
            stock,
            reorderPoint,
            targetStock,
            color: "#e2e9df",
            symbol: "📦",
        });
    }
    if (existing.length + products.length > 3000)
        errors.push({
            row: 0,
            message: "A notebook supports up to 3,000 products. Reduce this import.",
        });
    return { products, errors, duplicates };
}
