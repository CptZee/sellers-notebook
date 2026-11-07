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
        if (!user) return json({ error: "Sign in to view suppliers." }, 401);
        let filters;
        try {
            filters = parseInventoryQuery(new URL(request.url).searchParams);
        } catch {
            return json({ error: "Invalid supplier filters." }, 400);
        }
        const { page, size, revision, search } = filters;
        const result = await database().execute(sql`
   with source as (select coalesce((select revision from ${notebooks} where owner_id=${user.id}),0) revision),
   products as (select value,ordinality from source,${recordRows(user.id, "products")} records),
   matches as (select s.value,s.ordinality from source,${recordRows(user.id, "suppliers")} s where position(lower(${search}) in lower(concat_ws(' ',s.value->>'name',s.value->>'contact',s.value->>'email',s.value->>'phone')||coalesce((select ' '||string_agg((p.value->>'name')||' '||(p.value->>'sku'),' ' order by p.ordinality) from products p where s.value->'productIds' ? (p.value->>'id')),'')))>0),
   ranked as (select value,row_number() over(order by value->>'name' collate "en-US-x-icu" asc,ordinality asc) position from matches),
   totals as (select count(*)::int total from matches),
   bounds as (select *,greatest(1,ceil(total::numeric/${size})::int) pages,least(${page},greatest(1,ceil(total::numeric/${size})::int)) page from totals)
   select source.revision,bounds.total,bounds.pages,bounds.page,${size}::int "pageSize",(bounds.page-1)*${size} start,least(bounds.page*${size},bounds.total) "end",
    (select coalesce(jsonb_agg(value order by position),'[]'::jsonb) from ranked where position>(bounds.page-1)*${size} and position<=bounds.page*${size}) items
   from source cross join bounds
  `);
        const row = result.rows[0];
        if (Number(row.revision) !== revision)
            return json(
                { error: "Suppliers changed. Wait for the latest notebook revision." },
                409,
            );
        return json(row);
    } catch {
        return json({ error: "Suppliers are temporarily unavailable. Please retry." }, 503);
    }
}
