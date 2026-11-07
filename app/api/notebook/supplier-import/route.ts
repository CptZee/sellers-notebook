import { sql } from "drizzle-orm";
import { database } from "../../../../lib/db";
import { sessionUser, json, sameOrigin } from "../../../../lib/api";
import { readSupplierCsv, previewSupplierImport } from "../../../../lib/supplier-import.mjs";
import { recordRows, readSavedNotebook } from "../../../../lib/relational-notebook";
import { PATCH as patchNotebook } from "../route";
import type { Product, Supplier } from "../../../../lib/notebook-types";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
    try {
        const user = await sessionUser(request);
        if (!user) return json({ error: "Sign in to import suppliers." }, 401);
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
            if (typeof input.text !== "string")
                return json({ error: "Choose a supplier CSV." }, 400);
            let data;
            try {
                data = readSupplierCsv(input.text);
            } catch (e) {
                return json(
                    { error: e instanceof Error ? e.message : "Invalid supplier CSV." },
                    400,
                );
            }
            const names = [
                ...new Set(
                    data.rows.map((r) =>
                        String(r[data.mapping.name] ?? "")
                            .trim()
                            .toLowerCase(),
                    ),
                ),
            ];
            const skus = [
                ...new Set(
                    data.rows.flatMap((r) =>
                        String(r[data.mapping.skus] ?? "")
                            .split(";")
                            .map((s) => s.trim().toLowerCase())
                            .filter(Boolean),
                    ),
                ),
            ];
            const result = await database()
                .execute(sql`select coalesce((select revision from seller_notebooks where owner_id=${user.id}),0) revision,(select count(*)::int from seller_suppliers where owner_id=${user.id}) count,
   coalesce((select jsonb_agg(jsonb_build_object('name',name)) from seller_suppliers where owner_id=${user.id} and lower(btrim(name)) in (select jsonb_array_elements_text(${JSON.stringify(names)}::jsonb))),'[]'::jsonb) existing,
   coalesce((select jsonb_agg(value order by ordinality) from ${recordRows(user.id, "products")} p where lower(btrim(sku)) in (select jsonb_array_elements_text(${JSON.stringify(skus)}::jsonb))),'[]'::jsonb) products`);
            const row = result.rows[0];
            if (Number(row.revision) !== input.revision)
                return json({ error: "Records changed. Review a fresh supplier preview." }, 409);
            const products = row.products as Product[],
                preview = previewSupplierImport(
                    data.rows,
                    data.mapping,
                    row.existing as Pick<Supplier, "name">[],
                    products,
                );
            if (Number(row.count) + preview.suppliers.length > 1000)
                preview.errors.push({
                    row: 0,
                    message: "A notebook supports up to 1,000 suppliers. Reduce this import.",
                });
            return json({
                ...preview,
                revision: input.revision,
                products: products.map((p) => ({ id: p.id, sku: p.sku })),
            });
        }
        if (
            !Array.isArray(input.suppliers) ||
            !input.suppliers.length ||
            input.suppliers.length > 1000
        )
            return json({ error: "Import between 1 and 1,000 suppliers." }, 400);
        const saved = await readSavedNotebook(user.id);
        if (saved.revision !== input.revision)
            return json({ error: "Records changed. Review a fresh supplier preview." }, 409);
        const ids = new Set(saved.document.suppliers.map((s) => s.id)),
            names = new Set(saved.document.suppliers.map((s) => s.name.trim().toLowerCase()));
        for (const s of input.suppliers) {
            if (
                !s ||
                typeof s.id !== "string" ||
                typeof s.name !== "string" ||
                ids.has(s.id) ||
                names.has(s.name.trim().toLowerCase())
            )
                return json(
                    { error: "Some suppliers were already added. Review a fresh preview." },
                    409,
                );
            ids.add(s.id);
            names.add(s.name.trim().toLowerCase());
        }
        const changes = {
            suppliers: {
                remove: [],
                upsert: input.suppliers.map((record: unknown, index: number) => ({
                    index: saved.document.suppliers.length + index,
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
            { error: "The supplier import is temporarily unavailable. Keep your file and retry." },
            503,
        );
    }
}
