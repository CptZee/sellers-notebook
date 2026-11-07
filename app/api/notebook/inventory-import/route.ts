import { sql } from "drizzle-orm";
import { database } from "../../../../lib/db";
import { sessionUser, json, sameOrigin } from "../../../../lib/api";
import { inventoryFields, previewInventoryImport } from "../../../../lib/inventory-import.mjs";
import { readSavedNotebook } from "../../../../lib/relational-notebook";
import { PATCH as patchNotebook } from "../route";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
    try {
        const user = await sessionUser(request);
        if (!user) return json({ error: "Sign in to import inventory." }, 401);
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
            !["preview", "commit"].includes(input.mode)
        )
            return json({ error: "Invalid import request." }, 400);
        if (input.mode === "preview") {
            if (
                !Array.isArray(input.rows) ||
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
                        !inventoryFields.some((f) => f.key === k) ||
                        typeof v !== "string" ||
                        v.length > 200,
                )
            )
                return json({ error: "Invalid inventory rows or column mapping." }, 400);
            const skus = [
                ...new Set(
                    input.rows.map((r: Record<string, string>) =>
                        String(r[input.mapping.sku] ?? "")
                            .trim()
                            .toLowerCase(),
                    ),
                ),
            ];
            const result = await database().execute(
                sql`select coalesce((select revision from seller_notebooks where owner_id=${user.id}),0) revision,(select count(*)::int from seller_products where owner_id=${user.id}) count,coalesce((select jsonb_agg(jsonb_build_object('sku',sku)) from seller_products where owner_id=${user.id} and lower(btrim(sku)) in (select jsonb_array_elements_text(${JSON.stringify(skus)}::jsonb))),'[]'::jsonb) existing`,
            );
            const row = result.rows[0];
            if (Number(row.revision) !== input.revision)
                return json(
                    { error: "Inventory changed. Review a fresh preview before importing." },
                    409,
                );
            const preview = previewInventoryImport(
                input.rows,
                input.mapping,
                row.existing as Parameters<typeof previewInventoryImport>[2],
            );
            if (Number(row.count) + preview.products.length > 3000)
                preview.errors.push({
                    row: 0,
                    message: "A notebook supports up to 3,000 products. Reduce this import.",
                });
            return json({ ...preview, revision: input.revision });
        }
        if (
            !Array.isArray(input.products) ||
            !input.products.length ||
            input.products.length > 1000
        )
            return json({ error: "Import between 1 and 1,000 new products." }, 400);
        const saved = await readSavedNotebook(user.id);
        if (saved.revision !== input.revision)
            return json(
                { error: "Inventory changed. Review a fresh preview before importing." },
                409,
            );
        const ids = new Set(saved.document.products.map((p) => p.id)),
            skus = new Set(saved.document.products.map((p) => p.sku.trim().toLowerCase()));
        for (const p of input.products) {
            if (
                !p ||
                typeof p.id !== "string" ||
                typeof p.sku !== "string" ||
                ids.has(p.id) ||
                skus.has(p.sku.trim().toLowerCase())
            )
                return json(
                    { error: "Some products were already added. Review a fresh preview." },
                    409,
                );
            ids.add(p.id);
            skus.add(p.sku.trim().toLowerCase());
        }
        const changes = {
            products: {
                remove: [],
                upsert: input.products.map((record: unknown, index: number) => ({
                    index: saved.document.products.length + index,
                    record,
                })),
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
            { error: "The inventory import is temporarily unavailable. Keep your file and retry." },
            503,
        );
    }
}
