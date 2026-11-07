import { sessionUser, json } from "../../../../lib/api";
import { restockFilters, serverRestock } from "../../../../lib/server-restock";
import { recordRows } from "../../../../lib/relational-notebook";
import { database } from "../../../../lib/db";
import { sql } from "drizzle-orm";
import { downloadResponse } from "../../../../lib/saved-notebook";
import { restockIncomingCsv } from "../../../../lib/restock-purchase.mjs";
import type { Supplier } from "../../../../lib/notebook-types";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
    try {
        const user = await sessionUser(request);
        if (!user) return json({ error: "Sign in to plan a restock." }, 401);
        const params = new URL(request.url).searchParams;
        let filters;
        try {
            filters = restockFilters(params);
        } catch {
            return json({ error: "Invalid restock filters." }, 400);
        }
        const mode = params.get("mode") || "page";
        if (!["page", "csv", "draft"].includes(mode))
            return json({ error: "Invalid planner request." }, 400);
        const row = await serverRestock(user.id, filters, mode !== "page");
        if (Number(row.revision) !== filters.revision)
            return json({ error: "The notebook changed. Review the latest restock plan." }, 409);
        const items = row.items as (Parameters<typeof restockIncomingCsv>[0][number] & {
            suppliers: { id: string; name: string; leadTimeDays: number; position: number }[];
        })[];
        if (mode === "csv") {
            const contacts = new Map<string, Supplier & { position: number }>();
            for (const item of items)
                for (const s of item.suppliers) {
                    let entry = contacts.get(s.id);
                    if (!entry) {
                        entry = {
                            ...s,
                            contact: "",
                            email: "",
                            phone: "",
                            address: "",
                            notes: "",
                            productIds: [],
                        };
                        contacts.set(s.id, entry);
                    }
                    entry.productIds.push(item.id);
                }
            return downloadResponse(
                restockIncomingCsv(
                    items as Parameters<typeof restockIncomingCsv>[0],
                    [...contacts.values()].sort((a, b) => a.position - b.position),
                ),
                "restock-plan.csv",
                "text/csv;charset=utf-8",
                filters.revision,
            );
        }
        if (mode === "draft") {
            const lines = items.filter((i) => i.toBuy > 0);
            if (
                !lines.length ||
                lines.length > 100 ||
                ["all", "unlinked"].includes(filters.supplier)
            )
                return json(
                    {
                        error: "Choose one supplier and a plan with 1–100 products needing purchase.",
                    },
                    400,
                );
            // Pin contact and product snapshots to the same revision as the calculated plan.
            const result = await database().execute(
                sql`select (select revision from seller_notebooks where owner_id=${user.id}) revision,(select value from ${recordRows(user.id, "suppliers")} s where id=${filters.supplier}) supplier,coalesce((select jsonb_agg(value order by ordinality) from ${recordRows(user.id, "products")} p where id in (${sql.join(
                    lines.map((i) => sql`${i.id}`),
                    sql`,`,
                )}) ),'[]'::jsonb) products`,
            );
            const draft = result.rows[0];
            if (Number(draft.revision) !== filters.revision)
                return json(
                    { error: "The notebook changed. Review the latest restock plan." },
                    409,
                );
            return json({
                ...draft,
                lines: lines.map((i) => ({
                    productId: i.id,
                    quantity: i.toBuy,
                    unitCost: i.unitCost,
                })),
            });
        }
        return json(row);
    } catch {
        return json({ error: "The restock plan is temporarily unavailable. Please retry." }, 503);
    }
}
