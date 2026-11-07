import { sql } from "drizzle-orm";
import { database } from "../../../../lib/db";
import { sessionUser, json, sameOrigin } from "../../../../lib/api";
import { recordRows } from "../../../../lib/relational-notebook";
import {
    importFields,
    previewShopeeImport,
    type Mapping,
    type ImportOptions,
} from "../../../../lib/shopee-import.mjs";
import type { Product, Order } from "../../../../lib/notebook-types";
import { PATCH as patchNotebook } from "../route";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
    try {
        const user = await sessionUser(request);
        if (!user) return json({ error: "Sign in to import marketplace orders." }, 401);
        if (!sameOrigin(request)) return json({ error: "Cross-origin write rejected." }, 403);
        const raw = await request.text();
        if (new TextEncoder().encode(raw).length > 4000000)
            return json({ error: "This import request is too large." }, 413);
        let input;
        try {
            input = JSON.parse(raw);
        } catch {
            return json({ error: "Invalid import data." }, 400);
        }
        if (
            !input ||
            !Number.isSafeInteger(input.revision) ||
            input.revision < 0 ||
            !["preview", "commit"].includes(input.mode) ||
            !["Shopee", "Lazada", "TikTok Shop"].includes(input.platform) ||
            !Array.isArray(input.rows) ||
            !input.rows.length ||
            input.rows.length > 1000 ||
            input.rows.some(
                (r: unknown) =>
                    !r ||
                    typeof r !== "object" ||
                    Array.isArray(r) ||
                    Object.values(r).some((v) => typeof v !== "string"),
            ) ||
            !input.mapping ||
            typeof input.mapping !== "object" ||
            Array.isArray(input.mapping) ||
            Object.entries(input.mapping).some(
                ([k, v]) =>
                    !importFields.some((f) => f.key === k) ||
                    typeof v !== "string" ||
                    v.length > 200,
            ) ||
            !input.options ||
            !["ISO", "DMY", "MDY"].includes(input.options.dateFormat)
        )
            return json({ error: "Invalid marketplace rows, mapping or options." }, 400);
        const rows = input.rows as Record<string, string>[],
            mapping = input.mapping as Mapping,
            options = input.options as ImportOptions;
        const skus = [
                ...new Set(
                    rows.map((r) =>
                        String(r[mapping.sku] ?? "")
                            .trim()
                            .toLowerCase(),
                    ),
                ),
            ],
            sources = [
                ...new Set(
                    rows.map((r) =>
                        String(r[mapping.orderId] ?? "")
                            .trim()
                            .toUpperCase(),
                    ),
                ),
            ];
        const first = await database().execute(
            sql`select coalesce((select revision from seller_notebooks where owner_id=${user.id}),0) revision,coalesce((select jsonb_agg(value order by ordinality) from ${recordRows(user.id, "products")} p where lower(btrim(sku)) in (select jsonb_array_elements_text(${JSON.stringify(skus)}::jsonb))),'[]'::jsonb) products`,
        );
        if (Number(first.rows[0].revision) !== input.revision)
            return json({ error: "Records changed. Review a fresh marketplace preview." }, 409);
        const products = first.rows[0].products as Product[],
            initial = await previewShopeeImport(
                rows,
                mapping,
                products,
                [],
                options,
                input.platform,
            );
        const ids = initial.orders.map((o) => o.id);
        const second = await database()
            .execute(sql`select coalesce((select revision from seller_notebooks where owner_id=${user.id}),0) revision,(select count(*)::int from seller_orders where owner_id=${user.id}) count,
 coalesce((select jsonb_agg(jsonb_build_object('id',id,'channel',channel,'sourceOrderId',source_order_id)) from seller_orders where owner_id=${user.id} and (id in (select jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb)) or channel=${input.platform} and source_order_key in (select jsonb_array_elements_text(${JSON.stringify(sources)}::jsonb)))),'[]'::jsonb) existing`);
        const current = second.rows[0];
        if (Number(current.revision) !== input.revision)
            return json({ error: "Records changed. Review a fresh marketplace preview." }, 409);
        const preview = await previewShopeeImport(
            rows,
            mapping,
            products,
            current.existing as Pick<Order, "id" | "channel" | "sourceOrderId">[],
            options,
            input.platform,
        );
        if (Number(current.count) + preview.orders.length > 15000)
            preview.errors.push({
                row: 0,
                message: "A notebook supports up to 15,000 order lines. Reduce this import.",
            });
        if (input.mode === "preview")
            return json({
                ...preview,
                revision: input.revision,
                products: products.map((p) => ({ id: p.id, sku: p.sku })),
            });
        if (preview.errors.length || !preview.orders.length)
            return json(
                { error: "Review a valid preview with new order lines before importing." },
                400,
            );
        const changes = {
            orders: {
                remove: [],
                upsert: preview.orders.map((record, index) => ({ index, record })),
            },
        };
        return patchNotebook(
            new Request(request.url, {
                method: "PATCH",
                headers: request.headers,
                body: JSON.stringify({ revision: input.revision, changes }),
            }),
        );
    } catch {
        return json(
            {
                error: "The marketplace import is temporarily unavailable. Keep your file and retry.",
            },
            503,
        );
    }
}
