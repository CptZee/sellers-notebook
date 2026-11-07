import { eq } from "drizzle-orm";
import { sessionUser, json } from "../../../../lib/api";
import { database } from "../../../../lib/db";
import { notebooks } from "../../../../db/schema";
import { GET as orderRecord } from "../order/route";
import { GET as purchaseRecord } from "../purchase/route";
import { customerOrderHtml, customerOrderSummary } from "../../../../lib/order-copy.mjs";
import { purchaseCopyHtml } from "../../../../lib/purchase-copy.mjs";
import { downloadResponse } from "../../../../lib/saved-notebook";
import type { Branding, Order, RefundRecord, PurchaseOrder } from "../../../../lib/notebook-types";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
    try {
        const user = await sessionUser(request);
        if (!user) return json({ error: "Sign in to create this copy." }, 401);
        const params = new URL(request.url).searchParams,
            kind = params.get("kind"),
            id = params.get("id"),
            revision = params.get("revision");
        if (
            !["customer", "purchase"].includes(kind || "") ||
            !id ||
            id.length > 100 ||
            !revision ||
            !/^(0|[1-9]\d*)$/.test(revision) ||
            !Number.isSafeInteger(Number(revision))
        )
            return json({ error: "Invalid copy request." }, 400);
        // The existing record readers enforce owner isolation and pinned revisions.
        const response = await (kind === "customer" ? orderRecord : purchaseRecord)(request);
        if (!response.ok) return response;
        const data = await response.json();
        const [metadata] = await database()
            .select({
                revision: notebooks.revision,
                businessName: notebooks.business_name,
                notebookTitle: notebooks.notebook_title,
                tagline: notebooks.tagline,
                icon: notebooks.icon,
            })
            .from(notebooks)
            .where(eq(notebooks.owner_id, user.id));
        if (!metadata || metadata.revision !== Number(revision))
            return json(
                { error: "The notebook changed. Open the latest record before creating a copy." },
                409,
            );
        const branding = metadata.businessName
            ? ({
                  businessName: metadata.businessName,
                  notebookTitle: metadata.notebookTitle,
                  tagline: metadata.tagline,
                  icon: metadata.icon,
              } as Branding)
            : null;
        let body, filename;
        if (kind === "customer") {
            const orders = data.orders as Order[],
                refunds = data.refunds as RefundRecord[];
            body = customerOrderHtml(orders, branding, refunds);
            filename =
                "customer-order-" +
                customerOrderSummary(orders, branding, refunds)
                    .orderId.replace(/[^a-zA-Z0-9_-]/g, "-")
                    .slice(0, 80) +
                ".html";
        } else {
            const purchase = data.record as PurchaseOrder;
            body = purchaseCopyHtml(purchase, branding);
            filename =
                "purchase-" +
                purchase.reference.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 90) +
                ".html";
        }
        return downloadResponse(body, filename, "text/html;charset=utf-8", Number(revision));
    } catch {
        return json(
            { error: "This copy could not be prepared. Please retry the latest record." },
            503,
        );
    }
}
