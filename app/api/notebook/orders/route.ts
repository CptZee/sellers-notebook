import { recordRows, readSavedNotebook } from "../../../../lib/relational-notebook";
import { sql } from "drizzle-orm";
import { database } from "../../../../lib/db";
import { notebooks } from "../../../../db/schema";
import { sessionUser, json } from "../../../../lib/api";
import { parseOrdersQuery } from "../../../../lib/orders-query.mjs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
    try {
        const user = await sessionUser(request);
        if (!user) return json({ error: "Sign in to view orders." }, 401);
        let filters;
        try {
            filters = parseOrdersQuery(new URL(request.url).searchParams);
        } catch {
            return json({ error: "Invalid order filters." }, 400);
        }
        const { page, size, revision, search, period, channel, today, range, status, sort } =
            filters;
        const result = await database().execute(sql`
   with source as (select coalesce((select revision from ${notebooks} where owner_id=${user.id}),0) revision),
   orders as (select value from source,${recordRows(user.id, "orders")} records),
   products as (select value->>'id' id,value->>'sku' sku from source,${recordRows(user.id, "products")} records),
   dates as (select value->>'date' date from orders union all select value->>'date' from source,${recordRows(user.id, "expenses")} records union all select value->>'date' from source,${recordRows(user.id, "refundRecords")} records),
   report_bounds as (select case when ${period}='all' then coalesce((select min(date) from dates where date<=${today}),${today}) else ${range.from} end first,${range.to} last),
   matches as (select o.value from orders o left join products p on p.id=o.value->>'productId' cross join report_bounds b where o.value->>'date'>=b.first and o.value->>'date'<=b.last and (${channel}='All channels' or o.value->>'channel'=${channel}) and (${status}='All statuses' or o.value->>'status'=${status}) and position(lower(${search}) in lower(concat_ws(' ',o.value->>'id',coalesce(o.value->>'sourceOrderId',''),o.value->>'customer',o.value->>'productName',coalesce(p.sku,''))))>0),
   ranked as (select value,row_number() over(order by
    case when ${sort}='value' then (value->>'price')::double precision*(value->>'quantity')::double precision end desc,
    case when ${sort}='oldest' then value->>'date' end asc,
    case when ${sort}<>'oldest' then value->>'date' end desc,
    value->>'id' collate "en-US-x-icu" asc) position from matches),
   totals as (select count(*)::int total from matches),
   bounds as (select *,greatest(1,ceil(total::numeric/${size})::int) pages,least(${page},greatest(1,ceil(total::numeric/${size})::int)) page from totals)
   select source.revision,bounds.total,bounds.pages,bounds.page,${size}::int "pageSize",(bounds.page-1)*${size} start,least(bounds.page*${size},bounds.total) "end",
    (select coalesce(jsonb_agg(value order by position),'[]'::jsonb) from ranked where position>(bounds.page-1)*${size} and position<=bounds.page*${size}) items
   from source cross join bounds
  `);
        const row = result.rows[0];
        if (Number(row.revision) !== revision)
            return json({ error: "Orders changed. Wait for the latest notebook revision." }, 409);
        return json(row);
    } catch {
        return json({ error: "Orders are temporarily unavailable. Please retry." }, 503);
    }
}
