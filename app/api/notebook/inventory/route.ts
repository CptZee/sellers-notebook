import { recordRows, readSavedNotebook } from "../../../../lib/relational-notebook";
import { sql } from "drizzle-orm";
import { database } from "../../../../lib/db";
import { notebooks } from "../../../../db/schema";
import { sessionUser, json } from "../../../../lib/api";
import { parseInventoryQuery } from "../../../../lib/inventory-query.mjs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
    try {
        const user = await sessionUser(request);
        if (!user) return json({ error: "Sign in to view inventory." }, 401);
        let filters;
        try {
            filters = parseInventoryQuery(new URL(request.url).searchParams);
        } catch {
            return json({ error: "Invalid inventory filters." }, 400);
        }
        const { page, size, revision, search } = filters;
        const supplierId = new URL(request.url).searchParams.get("supplierId") || "";
        if (supplierId.length > 100) return json({ error: "Invalid supplier filter." }, 400);
        const result = await database().execute(sql`
   with source as (select coalesce((select revision from ${notebooks} where owner_id=${user.id}),0) revision),
   matches as (select value,ordinality from source,${recordRows(user.id, "products")} p where position(lower(${search}) in lower((value->>'name')||' '||(value->>'sku')))>0 and (${supplierId}='' or exists(select 1 from ${recordRows(user.id, "suppliers")} s where s.value->>'id'=${supplierId} and s.value->'productIds' ? (p.value->>'id')))),
   totals as (select count(*)::int total from matches),
   bounds as (select *,greatest(1,ceil(total::numeric/${size})::int) pages,least(${page},greatest(1,ceil(total::numeric/${size})::int)) page from totals)
   select source.revision,bounds.total,bounds.pages,bounds.page,${size}::int "pageSize",(bounds.page-1)*${size} start,least(bounds.page*${size},bounds.total) "end",
    (select coalesce(jsonb_agg(jsonb_build_object('product',m.value,'suppliers',(select coalesce(jsonb_agg(jsonb_build_object('id',s.value->>'id','name',s.value->>'name')),'[]'::jsonb) from ${recordRows(user.id, "suppliers")} s where s.value->'productIds' ? (m.value->>'id'))) order by m.ordinality),'[]'::jsonb) from (select * from matches order by ordinality limit ${size} offset (bounds.page-1)*${size}) m) items
   from source cross join bounds
  `);
        const row = result.rows[0];
        if (Number(row.revision) !== revision)
            return json(
                { error: "Inventory changed. Wait for the latest notebook revision." },
                409,
            );
        return json(row);
    } catch {
        return json({ error: "Inventory is temporarily unavailable. Please retry." }, 503);
    }
}
