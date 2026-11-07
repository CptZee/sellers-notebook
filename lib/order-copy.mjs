export function orderGroup(orders, id) {
    const selected = orders.find((order) => order.id === id);
    if (!selected) return [];
    return selected.sourceOrderId
        ? orders.filter(
              (order) =>
                  order.channel === selected.channel &&
                  order.sourceOrderId?.trim().toUpperCase() ===
                      selected.sourceOrderId.trim().toUpperCase(),
          )
        : [selected];
}
const escape = (value) =>
    String(value ?? "").replace(
        /[&<>"']/g,
        (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
    );
const money = (value) =>
    new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
export function customerOrderSummary(lines, branding, refundRecords = []) {
    if (!lines.length) throw Error("This order is no longer available.");
    const first = lines[0],
        statuses = [...new Set(lines.map((line) => line.status))],
        dates = [...new Set(lines.map((line) => line.date))].sort();
    const items = lines.map((line) => ({
        productName: line.productName,
        quantity: line.quantity,
        price: line.price,
        status: line.status,
        total: line.status === "Cancelled" ? 0 : Math.round(line.price * line.quantity * 100) / 100,
    }));
    const refunded =
        refundRecords
            .filter((record) => lines.some((line) => line.id === record.orderId))
            .reduce((cents, record) => cents + Math.round(record.amount * 100), 0) / 100;
    return {
        refunded,
        businessName: branding?.businessName || "Seller’s Notebook",
        notebookTitle: branding?.notebookTitle || "",
        tagline: branding?.tagline || "",
        orderId: first.sourceOrderId || first.id,
        channel: first.channel,
        customer: [...new Set(lines.map((line) => line.customer))].join(", "),
        date: dates.length === 1 ? dates[0] : `${dates[0]} – ${dates.at(-1)}`,
        status: statuses.length === 1 ? statuses[0] : "Mixed statuses",
        items,
        total: items.reduce((cents, item) => cents + Math.round(item.total * 100), 0) / 100,
    };
}
export function customerOrderHtml(lines, branding, refundRecords = []) {
    const copy = customerOrderSummary(lines, branding, refundRecords);
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Order ${escape(copy.orderId)} — ${escape(copy.businessName)}</title><style>body{font:15px/1.6 system-ui,sans-serif;color:#263248;background:#fff;margin:0;padding:40px}main{max-width:800px;margin:auto}h1,p{overflow-wrap:anywhere}h1{font-size:30px;line-height:1.2;margin:0 0 8px}h2{font-size:20px;margin:28px 0 14px}p{margin:5px 0;color:#526078}table{width:100%;border-collapse:collapse;margin:24px 0}th,td{padding:12px 8px;text-align:left;border-bottom:1px solid #dce1e8;overflow-wrap:anywhere}th{font-size:12px;color:#526078}.total{text-align:right;font-size:23px;font-weight:700}.note{font-size:12px;color:#64718a}a{color:inherit}@media(max-width:600px){body{padding:20px}table{font-size:12px}th,td{padding:8px 4px}}@media print{body{padding:0}tr{break-inside:avoid}a{text-decoration:none}}</style></head><body><main><h1>${escape(copy.businessName)}</h1>${copy.tagline ? `<p>${escape(copy.tagline)}</p>` : ""}<h2>Order summary</h2><p><strong>Order:</strong> ${escape(copy.orderId)}</p><p><strong>Customer:</strong> ${escape(copy.customer)}</p><p><strong>Channel:</strong> ${escape(copy.channel)}</p><p><strong>Date:</strong> ${escape(copy.date)}</p><p><strong>Status:</strong> ${escape(copy.status)}</p><table><thead><tr><th>Product</th><th>Qty</th><th>Unit price</th><th>Status</th><th>Amount</th></tr></thead><tbody>${copy.items.map((item) => `<tr><td>${escape(item.productName)}</td><td>${escape(item.quantity)}</td><td>${escape(money(item.price))}</td><td>${escape(item.status)}</td><td>${escape(money(item.total))}</td></tr>`).join("")}</tbody></table><p class="total">Recorded item total: ${escape(money(copy.total))}</p>${copy.refunded ? `<p class="total">Recorded refunds: ${escape(money(copy.refunded))}</p><p class="total">After refunds: ${escape(money(copy.total - copy.refunded))}</p>` : ""}<p class="note">Items shown reflect the recorded order lines. Cancelled lines are excluded from the total.</p></main></body></html>`;
}
