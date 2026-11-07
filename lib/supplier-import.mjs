import Papa from "papaparse";
import { validDocument } from "./notebook-validation.mjs";
const fields = {
    name: ["supplier", "supplier name", "name"],
    contact: ["contact person", "contact"],
    email: ["email"],
    phone: ["phone", "telephone"],
    address: ["address"],
    notes: ["notes"],
    leadTimeDays: ["lead time (days)", "lead time days", "lead time"],
    skus: ["product skus", "skus"],
};
export function readSupplierCsv(text) {
    if (new TextEncoder().encode(text).length > 2 * 1024 * 1024)
        throw Error("Choose a CSV file up to 2 MB.");
    const result = Papa.parse(text.replace(/^\uFEFF/, ""), {
        delimiter: ",",
        header: true,
        skipEmptyLines: "greedy",
        transformHeader: (header) => header.trim(),
    });
    if (result.errors.length) throw Error(`CSV could not be read: ${result.errors[0].message}`);
    const headers = result.meta.fields || [];
    if (
        !headers.length ||
        Object.keys(result.meta.renamedHeaders || {}).length ||
        new Set(headers.map((h) => h.toLowerCase())).size !== headers.length ||
        headers.some((h) => !h || ["__proto__", "constructor", "prototype"].includes(h))
    )
        throw Error("Use unique, non-empty column headings.");
    if (!result.data.length || result.data.length > 1000)
        throw Error("Import between 1 and 1,000 supplier rows.");
    for (const aliases of Object.values(fields))
        if (headers.filter((header) => aliases.includes(header.toLowerCase())).length > 1)
            throw Error("Use only one column for each supplier field.");
    const parsed = { headers, rows: result.data };
    const mapping = Object.fromEntries(
        Object.entries(fields).map(([key, aliases]) => [
            key,
            parsed.headers.find((header) => aliases.includes(header.toLowerCase())) || "",
        ]),
    );
    if (!mapping.name)
        throw Error(
            "Include a Supplier or Supplier name column. Download the template for supported headers.",
        );
    return { ...parsed, mapping };
}
export function previewSupplierImport(rows, mapping, existing, products) {
    const suppliers = [],
        errors = [],
        seen = new Set(),
        known = new Set(existing.map((s) => s.name.trim().toLowerCase()));
    let duplicates = 0;
    if (!mapping.name || rows.length > 1000)
        return {
            suppliers,
            duplicates,
            errors: [
                { row: 0, message: "Include a supplier name column and import up to 1,000 rows." },
            ],
        };
    const skuMap = new Map(products.map((p) => [p.sku.trim().toLowerCase(), p.id]));
    for (let index = 0; index < rows.length; index++) {
        const get = (key) => String(rows[index][mapping[key]] ?? "").trim(),
            name = get("name"),
            key = name.toLowerCase(),
            row = index + 2;
        if (!name) {
            errors.push({ row, message: "Supplier name is required." });
            continue;
        }
        if (seen.has(key)) {
            errors.push({ row, message: `Supplier “${name}” occurs twice in this file.` });
            continue;
        }
        seen.add(key);
        if (known.has(key)) {
            duplicates++;
            continue;
        }
        const skus = [
                ...new Set(
                    get("skus")
                        .split(";")
                        .map((s) => s.trim().toLowerCase())
                        .filter(Boolean),
                ),
            ],
            missing = skus.filter((sku) => !skuMap.has(sku));
        if (missing.length) {
            errors.push({
                row,
                message: `Unknown inventory SKUs: ${missing.join(", ")}. Add the products first or remove these links.`,
            });
            continue;
        }
        const lead = get("leadTimeDays");
        const supplier = {
            id: crypto.randomUUID(),
            name,
            contact: get("contact"),
            email: get("email"),
            phone: get("phone"),
            address: get("address"),
            notes: get("notes"),
            leadTimeDays: lead && /^\d+$/.test(lead) ? Number(lead) : lead ? NaN : 0,
            productIds: skus.map((sku) => skuMap.get(sku)),
        };
        if (!validDocument({ products, orders: [], suppliers: [supplier] })) {
            errors.push({
                row,
                message:
                    "Check name/contact lengths, email format, and lead time (whole days from 0 to 3,650).",
            });
            continue;
        }
        suppliers.push(supplier);
    }
    if (existing.length + suppliers.length > 1000)
        errors.push({
            row: 0,
            message: "A notebook supports up to 1,000 suppliers. Reduce this import.",
        });
    return { suppliers, duplicates, errors };
}
