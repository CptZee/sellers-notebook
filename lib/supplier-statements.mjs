import { purchasePaymentSummary } from "./purchase-payments.mjs";
export function statementSuppliers(suppliers, orders) {
    const options = new Map(
        suppliers.map((s) => [s.id, { id: s.id, name: s.name, archived: false }]),
    );
    for (const order of orders)
        if (!options.has(order.supplierId))
            options.set(order.supplierId, {
                id: order.supplierId,
                name: order.supplierName,
                archived: true,
            });
    return [...options.values()].sort((a, b) => a.name.localeCompare(b.name));
}
export function supplierStatement(
    orders,
    { supplierId = "all", status = "All statuses", search = "" } = {},
) {
    const query = search.trim().toLowerCase();
    const rows = orders
        .filter(
            (order) =>
                (supplierId === "all" || order.supplierId === supplierId) &&
                (status === "All statuses" || order.status === status) &&
                [
                    order.reference,
                    order.supplierName,
                    ...order.items.map((item) => item.productName + " " + item.sku),
                ]
                    .join(" ")
                    .toLowerCase()
                    .includes(query),
        )
        .toSorted(
            (a, b) =>
                b.createdAt.localeCompare(a.createdAt) || a.reference.localeCompare(b.reference),
        )
        .map((order) => ({
            id: order.id,
            reference: order.reference,
            supplierId: order.supplierId,
            supplierName: order.supplierName,
            date: new Date(order.createdAt).toLocaleDateString("en-CA", {
                timeZone: "Asia/Manila",
            }),
            status: order.status,
            ...purchasePaymentSummary(order),
        }));
    const keys = ["originalTotal", "itemTotal", "paid", "refunded", "netPaid", "balance", "credit"];
    const totals = Object.fromEntries(
        keys.map((key) => [
            key,
            rows.reduce((cents, row) => cents + Math.round(row[key] * 100), 0) / 100,
        ]),
    );
    return { rows, totals };
}
export function supplierStatementCsv(rows) {
    const headings = [
        "Purchase reference",
        "Supplier",
        "Created (Asia/Manila)",
        "Status",
        "Original ordered items (PHP)",
        "Item amount to reconcile (PHP)",
        "Recorded payments (PHP)",
        "Supplier refunds received (PHP)",
        "Net paid (PHP)",
        "Unrecorded item balance (PHP)",
        "Credit to review (PHP)",
    ];
    const values = rows.map((row) => [
        row.reference,
        row.supplierName,
        row.date,
        row.status,
        ...["originalTotal", "itemTotal", "paid", "refunded", "netPaid", "balance", "credit"].map(
            (key) => row[key].toFixed(2),
        ),
    ]);
    return (
        "\uFEFF" +
        [headings, ...values]
            .map((row) =>
                row
                    .map(
                        (cell) =>
                            '"' +
                            String(cell)
                                .replace(/^\s*[=+@-]/, "'$&")
                                .replaceAll('"', '""') +
                            '"',
                    )
                    .join(","),
            )
            .join("\r\n")
    );
}
const escape = (value) =>
    String(value ?? "").replace(
        /[&<>"']/g,
        (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
    );
const money = (value) =>
    new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
export function supplierStatementHtml(
    orders,
    filters = {},
    suppliers = [],
    branding = null,
    now = new Date(),
) {
    const { rows, totals } = supplierStatement(orders, filters),
        option = statementSuppliers(suppliers, orders).find((s) => s.id === filters.supplierId);
    const business = branding?.businessName || "Seller’s Notebook",
        supplier =
            !filters.supplierId || filters.supplierId === "all"
                ? "All suppliers"
                : option
                  ? option.name + (option.archived ? " · Archived supplier" : "")
                  : "Selected supplier";
    const prepared = now.toLocaleString("en-PH", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
    const cards = [
        ["Item amount to reconcile", totals.itemTotal],
        ["Recorded payments", totals.paid],
        ["Supplier refunds received", totals.refunded],
        ["Net paid", totals.netPaid],
        ["Unrecorded item balance", totals.balance],
        ["Credit to review", totals.credit],
    ];
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Supplier statement — ${escape(business)}</title><style>body{margin:0;padding:32px;background:#fff;color:#30463b;font:14px/1.6 system-ui,sans-serif}main{max-width:1120px;margin:auto}header{padding-bottom:18px;border-bottom:1px dashed #acb8a8}h1{font-size:28px;margin:0}h2{font-size:22px;margin:22px 0 12px}p{margin:6px 0;overflow-wrap:anywhere}.meta{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px}.totals{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:22px 0}.totals div{border:1px solid #d9dfd6;padding:12px;min-width:0}.totals small{display:block;color:#607064}.totals strong{display:block;margin-top:6px;font-size:18px;overflow-wrap:anywhere}.table-wrap{overflow-x:auto}table{border-collapse:collapse;width:100%;min-width:760px;table-layout:fixed;margin:18px 0}th,td{padding:10px 5px;border-bottom:1px solid #d9dfd6;text-align:left;vertical-align:top;overflow-wrap:anywhere;font-size:11px}th:first-child{width:25%}td small{display:block;color:#607064}.note{font-size:12px;color:#607064;margin-top:16px}@media(max-width:600px){body{padding:18px}.meta,.totals{grid-template-columns:1fr}}@media print{@page{size:A4 landscape;margin:12mm}body{padding:0}.table-wrap{overflow:visible}table{min-width:0}thead{display:table-header-group}tr,.totals div{break-inside:avoid}.meta{grid-template-columns:1fr 1fr}.totals{grid-template-columns:repeat(3,minmax(0,1fr));break-inside:avoid}}</style></head><body><main><header><h1>${escape(business)}</h1>${branding?.tagline ? `<p>${escape(branding.tagline)}</p>` : ""}</header><h2>Supplier statement</h2><div class="meta"><p><strong>Supplier:</strong> ${escape(supplier)}</p><p><strong>Prepared:</strong> ${escape(prepared)} · Asia/Manila</p><p><strong>Status filter:</strong> ${escape(filters.status || "All statuses")}</p><p><strong>Matching purchases:</strong> ${rows.length}</p>${filters.search ? `<p><strong>Search filter:</strong> ${escape(filters.search)}</p>` : ""}</div><div class="totals">${cards.map(([label, value]) => `<div><small>${escape(label)}</small><strong>${escape(money(value))}</strong></div>`).join("")}</div><div class="table-wrap"><table><thead><tr><th>Purchase / supplier</th><th>Status</th><th>Item amount</th><th>Payments</th><th>Refunds</th><th>Net paid</th><th>Item balance</th><th>Credit</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escape(row.reference)}<small>${escape(row.supplierName)}</small><small>${escape(row.date)}</small></td><td>${escape(row.status)}</td>${["itemTotal", "paid", "refunded", "netPaid", "balance", "credit"].map((key) => `<td>${escape(money(row[key]))}</td>`).join("")}</tr>`).join("")}</tbody></table></div><p class="note">Current lifetime item records for all matching purchases, including every page. Tax and delivery are excluded. Cancelled purchases reconcile only received items. Balances and credits remain separate; this statement does not assume settlement between purchases or confirm supplier agreement. Payment references and private notes are omitted.</p><p class="note">Original ordered item total: ${escape(money(totals.originalTotal))}. Purchase creation dates are shown in Asia/Manila. Payment and refund totals include all records currently recorded against these purchases.</p></main></body></html>`;
}
