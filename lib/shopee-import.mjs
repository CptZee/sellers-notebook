import Papa from "papaparse";

export const importFields = [
    {
        key: "orderId",
        label: "Marketplace order ID",
        required: true,
        aliases: ["order id", "order sn", "order number", "order_id", "orderid"],
    },
    {
        key: "sku",
        label: "Seller SKU",
        required: true,
        aliases: [
            "seller sku",
            "sku",
            "sku reference no.",
            "sku reference number",
            "variation sku",
            "seller_sku",
            "sellersku",
            "seller sku id",
        ],
    },
    {
        key: "quantity",
        label: "Quantity",
        required: true,
        aliases: ["quantity", "qty", "item quantity"],
    },
    {
        key: "price",
        label: "Selling price per item (PHP)",
        required: true,
        aliases: [
            "unit price",
            "selling price",
            "discounted price",
            "deal price",
            "unit_price",
            "unitprice",
            "sku unit sale price",
        ],
    },
    {
        key: "date",
        label: "Order date",
        required: true,
        aliases: [
            "order date",
            "order creation date",
            "order creation time",
            "created at",
            "create time",
            "order create time",
            "created_time",
            "createtime",
        ],
    },
    {
        key: "status",
        label: "Order status",
        required: true,
        aliases: ["order status", "status", "order_status"],
    },
    {
        key: "customer",
        label: "Buyer name (optional)",
        required: false,
        aliases: [
            "buyer username",
            "buyer",
            "customer",
            "customer name",
            "buyer name",
            "recipient name",
            "recipient_name",
        ],
    },
    { key: "currency", label: "Currency (optional)", required: false, aliases: ["currency"] },
];
export function readShopeeCsv(text) {
    if (new TextEncoder().encode(text).length > 2 * 1024 * 1024)
        throw new Error("Use a CSV file smaller than 2 MB.");
    const parsed = Papa.parse(text.replace(/^\uFEFF/, ""), {
        header: true,
        skipEmptyLines: "greedy",
        transformHeader: (header) => header.trim(),
    });
    if (parsed.errors.length) throw new Error(`CSV could not be read: ${parsed.errors[0].message}`);
    const headers = parsed.meta.fields || [];
    if (
        headers.length < 2 ||
        new Set(headers).size !== headers.length ||
        Object.keys(parsed.meta.renamedHeaders || {}).length
    )
        throw new Error("Use a CSV with unique column headings.");
    if (!parsed.data.length || parsed.data.length > 1000)
        throw new Error("Import between 1 and 1,000 rows at a time.");
    if (headers.some((h) => !h || h === "__proto__" || h === "constructor" || h === "prototype"))
        throw new Error("Rename empty or reserved column headings.");
    const mapping = Object.fromEntries(
        importFields.map((field) => [
            field.key,
            headers.find((header) => field.aliases.includes(header.toLowerCase())) || "",
        ]),
    );
    return { headers, rows: parsed.data, mapping };
}
function decimal(value) {
    const text = String(value ?? "")
        .trim()
        .replace(/^(?:PHP|₱)\s*/i, "");
    if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(text)) return NaN;
    return Number(text.replaceAll(",", ""));
}
function dateValue(value, format) {
    const text = String(value || "")
        .trim()
        .split(/[ T]/)[0];
    let year, month, day;
    if (format === "ISO") {
        const m = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
        if (!m) return null;
        [, year, month, day] = m;
    } else {
        const m = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
        if (!m) return null;
        year = m[3];
        [day, month] = format === "DMY" ? [m[1], m[2]] : [m[2], m[1]];
    }
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date
        ? date
        : null;
}
function statusValue(value) {
    const status = String(value || "")
        .trim()
        .toUpperCase()
        .replace(/[ -]+/g, "_");
    if (status === "COMPLETED") return "Completed";
    if (["CANCELLED", "CANCELED"].includes(status)) return "Cancelled";
    if (
        [
            "PROCESSING",
            "UNPAID",
            "READY_TO_SHIP",
            "PROCESSED",
            "SHIPPED",
            "TO_SHIP",
            "TO_RECEIVE",
            "TO_CONFIRM_RECEIVE",
            "DELIVERED",
            "IN_CANCEL",
            "PENDING",
            "PACKED",
            "AWAITING_SHIPMENT",
            "AWAITING_COLLECTION",
            "IN_TRANSIT",
            "UNPAID_ORDER",
        ].includes(status)
    )
        return "Processing";
    return null;
}
async function orderKey(orderId, sku, platform) {
    const bytes = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(
            JSON.stringify([
                platform === "Shopee" ? "shopee" : platform.toLowerCase(),
                orderId.toUpperCase(),
                sku.toLowerCase(),
            ]),
        ),
    );
    return (
        { Shopee: "SHP-", Lazada: "LZD-", "TikTok Shop": "TTS-" }[platform] +
        Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("")
    );
}
export async function previewShopeeImport(
    rows,
    mapping,
    products,
    existingOrders,
    options,
    platform = "Shopee",
) {
    if (!["Shopee", "Lazada", "TikTok Shop"].includes(platform))
        throw new Error("Choose a supported marketplace.");
    const errors = [],
        candidates = [],
        seen = new Set(),
        existing = new Set(existingOrders.map((o) => o.id));
    const charged = new Set(
        existingOrders
            .filter((o) => o.sourceOrderId && o.channel === platform)
            .map((o) => o.sourceOrderId.toUpperCase()),
    );
    let duplicates = 0;
    for (const field of importFields)
        if (field.required && !mapping[field.key])
            errors.push({ row: 0, message: `Choose the ${field.label} column.` });
    if (
        !options ||
        ![options.fee, options.packaging, options.shipping].every(
            (v) => Number.isFinite(v) && v >= 0 && v <= 100000000,
        ) ||
        options.fee >= 100
    )
        errors.push({ row: 0, message: "Enter nonnegative costs and a fee below 100%." });
    if (errors.length) return { orders: candidates, errors, duplicates };
    const productMap = new Map(products.map((p) => [p.sku.trim().toLowerCase(), p]));
    for (let index = 0; index < rows.length; index++) {
        const source = rows[index],
            get = (key) => String(source[mapping[key]] ?? "").trim(),
            row = index + 2;
        const orderId = get("orderId"),
            sku = get("sku"),
            quantity = decimal(get("quantity")),
            price = decimal(get("price")),
            date = dateValue(get("date"), options.dateFormat),
            status = statusValue(get("status")),
            product = productMap.get(sku.toLowerCase());
        const problem =
            !orderId || orderId.length > 100
                ? `Enter a ${platform} order ID of 1–100 characters.`
                : !product
                  ? `No inventory product matches SKU “${sku || "(empty)"}”. Add it to Inventory first.`
                  : !Number.isInteger(quantity) || quantity < 1 || quantity > 10000000
                    ? "Quantity must be a positive whole number."
                    : !Number.isFinite(price) || price < 0 || price > 100000000
                      ? "Use a valid selling price per item."
                      : !date
                        ? "Check the date and selected date format."
                        : !status
                          ? `Unsupported status “${get("status")}”. Refunds and returns need separate handling.`
                          : get("currency") && get("currency").toUpperCase() !== "PHP"
                            ? "This notebook supports PHP imports only."
                            : null;
        if (problem) {
            errors.push({ row, message: problem });
            continue;
        }
        const id = await orderKey(orderId, sku, platform);
        if (seen.has(id)) {
            errors.push({
                row,
                message:
                    "The same order ID and SKU appear twice in this file. Consolidate those lines before importing.",
            });
            continue;
        }
        seen.add(id);
        if (existing.has(id)) {
            duplicates++;
            continue;
        }
        const chargeCosts = !charged.has(orderId.toUpperCase());
        charged.add(orderId.toUpperCase());
        candidates.push({
            id,
            productId: product.id,
            productName: product.name,
            customer: get("customer").slice(0, 200) || `${platform} buyer`,
            channel: platform,
            quantity,
            price,
            cost: product.cost,
            fee: options.fee,
            packaging: chargeCosts ? options.packaging : 0,
            shipping: chargeCosts ? options.shipping : 0,
            date,
            status,
            sourceOrderId: orderId,
            stockApplied: false,
        });
    }
    return { orders: candidates, errors, duplicates };
}
