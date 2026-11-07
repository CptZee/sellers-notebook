import { returnedUnits, returnCreditCents } from "./supplier-returns.mjs";
import { receivedUnits } from "./purchases.mjs";
const escape = (value) =>
    String(value ?? "").replace(
        /[&<>"']/g,
        (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
    );
const money = (value) =>
    new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
const active = (order) => ["Ordered", "Partially received"].includes(order.status);
export function isPurchaseOverdue(order, today) {
    return active(order) && !!order.expectedDate && order.expectedDate < today;
}
export function purchaseOverview(orders, today) {
    const open = orders.filter(active);
    return {
        openCount: open.length,
        overdueCount: open.filter((o) => isPurchaseOverdue(o, today)).length,
        outstandingUnits: open.reduce(
            (sum, o) => sum + o.items.reduce((n, i) => n + i.quantity - receivedUnits(o, i), 0),
            0,
        ),
        outstandingCost:
            open.reduce(
                (sum, o) =>
                    sum +
                    o.items.reduce(
                        (n, i) =>
                            n + Math.round(i.unitCost * 100) * (i.quantity - receivedUnits(o, i)),
                        0,
                    ),
                0,
            ) / 100,
    };
}
export function purchaseCopySummary(order, branding) {
    if (!order?.items?.length) throw Error("This purchase is no longer available.");
    const items = order.items.map((item) => ({
        productName: item.productName,
        sku: item.sku,
        ...(returnedUnits(order, item.productId)
            ? { returned: returnedUnits(order, item.productId) }
            : {}),
        quantity: item.quantity,
        received: receivedUnits(order, item),
        outstanding: active(order) ? item.quantity - receivedUnits(order, item) : 0,
        cancelled: order.status === "Cancelled" ? item.quantity - receivedUnits(order, item) : 0,
        unitCost: item.unitCost,
        total: (Math.round(item.unitCost * 100) * item.quantity) / 100,
    }));
    return {
        ...(returnCreditCents(order) ? { returnCredit: returnCreditCents(order) / 100 } : {}),
        businessName: branding?.businessName || "Seller’s Notebook",
        tagline: branding?.tagline || "",
        reference: order.reference,
        supplierName: order.supplierName,
        status: order.status,
        date: new Date(order.createdAt).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }),
        expectedDate: order.expectedDate,
        items,
        total: items.reduce((sum, i) => sum + Math.round(i.total * 100), 0) / 100,
        outstandingTotal:
            items.reduce((sum, i) => sum + Math.round(i.unitCost * 100) * i.outstanding, 0) / 100,
    };
}
export function purchaseCopyHtml(order, branding) {
    const copy = purchaseCopySummary(order, branding);
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Purchase ${escape(copy.reference)} — ${escape(copy.businessName)}</title><style>body{font:14px/1.65 system-ui,sans-serif;color:#30463b;background:#fff;margin:0;padding:36px}main{max-width:900px;margin:auto}header{border-bottom:1px dashed #acb8a8;padding-bottom:20px;margin-bottom:24px}h1{font-size:29px;margin:0}h2{font-size:22px;margin:18px 0}p{margin:6px 0}h1,p,td,th{overflow-wrap:anywhere}.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px}table{width:100%;border-collapse:collapse;margin:24px 0;table-layout:fixed}th,td{text-align:left;border-bottom:1px solid #d9dfd6;padding:10px 5px;vertical-align:top;font-size:12px}th:first-child{width:27%}td small{display:block;color:#607064}.total{font-size:18px;text-align:right;font-weight:600}.note{font-size:12px;color:#607064;margin-top:18px}@media(max-width:600px){body{padding:18px}.meta{grid-template-columns:1fr}th,td{font-size:10px;padding:8px 3px}.total{text-align:left}}@media print{@page{margin:14mm}body{padding:0}tr{break-inside:avoid}thead{display:table-header-group}.meta{grid-template-columns:1fr 1fr}}</style></head><body><main><header><h1>${escape(copy.businessName)}</h1>${copy.tagline ? `<p>${escape(copy.tagline)}</p>` : ""}</header><h2>Purchase order</h2><div class="meta"><p><strong>Reference:</strong> ${escape(copy.reference)}</p><p><strong>Supplier:</strong> ${escape(copy.supplierName)}</p><p><strong>Created:</strong> ${escape(copy.date)}</p><p><strong>Status:</strong> ${escape(copy.status)}</p>${copy.expectedDate ? `<p><strong>Expected delivery:</strong> ${escape(copy.expectedDate)}</p>` : ""}</div><table><thead><tr><th>Product / SKU</th><th>Ordered</th><th>Received</th><th>Outstanding</th><th>Unit cost</th><th>Ordered amount</th></tr></thead><tbody>${copy.items.map((item) => `<tr><td>${escape(item.productName)}<small>${escape(item.sku)}</small>${item.returned ? `<small>${escape(item.returned)} units returned</small>` : ""}${item.cancelled ? `<small>${escape(item.cancelled)} units cancelled</small>` : ""}</td><td>${escape(item.quantity)}</td><td>${escape(item.received)}</td><td>${escape(item.outstanding)}</td><td>${escape(money(item.unitCost))}</td><td>${escape(money(item.total))}</td></tr>`).join("")}</tbody></table><p class="total">Original ordered item total: ${escape(money(copy.total))}</p><p class="total">Outstanding item estimate: ${escape(money(copy.outstandingTotal))}</p>${copy.returnCredit ? `<p class="total">Recorded returned item credit: ${escape(money(copy.returnCredit))}</p>` : ""}<p class="note">Recorded purchase details only. Amounts exclude delivery and taxes and do not confirm payment or supplier acceptance. Cancelled quantities are excluded from the outstanding estimate.</p></main></body></html>`;
}
