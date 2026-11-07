import { recordRows, readSavedNotebook } from "../../../../lib/relational-notebook";
import { sql } from "drizzle-orm";
import { database } from "../../../../lib/db";
import { notebooks } from "../../../../db/schema";
import { sessionUser, json } from "../../../../lib/api";
import { parseExpensesQuery } from "../../../../lib/expenses-query.mjs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
    try {
        const user = await sessionUser(request);
        if (!user) return json({ error: "Sign in to view expenses." }, 401);
        let filters;
        try {
            filters = parseExpensesQuery(new URL(request.url).searchParams);
        } catch {
            return json({ error: "Invalid expense filters." }, 400);
        }
        const { page, size, revision, search, period, channel, today, range, category } = filters;
        const result = await database().execute(sql`
   with source as (select coalesce((select revision from ${notebooks} where owner_id=${user.id}),0) revision),
   expenses as (select value,ordinality from source,${recordRows(user.id, "expenses")} records),
   dates as (select value->>'date' date from expenses union all select value->>'date' from source,${recordRows(user.id, "orders")} records union all select value->>'date' from source,${recordRows(user.id, "refundRecords")} records),
   report_bounds as (select case when ${period}='all' then coalesce((select min(date) from dates where date<=${today}),${today}) else ${range.from} end first,${range.to} last),
   matches as (select e.value,e.ordinality from expenses e cross join report_bounds b where e.value->>'date'>=b.first and e.value->>'date'<=b.last and (${channel}='All channels' or e.value->>'channel'=${channel}) and (${category}='All categories' or e.value->>'category'=${category}) and position(lower(${search}) in lower((e.value->>'title')||' '||coalesce(e.value->>'notes','')))>0),
   ranked as (select value,row_number() over(order by value->>'date' desc,ordinality asc) position from matches),
   totals as (select count(*)::int total,coalesce(sum(floor((value->>'amount')::double precision*100+0.5)::numeric),0)/100 amount from matches),
   bounds as (select *,greatest(1,ceil(total::numeric/${size})::int) pages,least(${page},greatest(1,ceil(total::numeric/${size})::int)) page from totals)
   select source.revision,bounds.total,bounds.amount "totalAmount",bounds.pages,bounds.page,${size}::int "pageSize",(bounds.page-1)*${size} start,least(bounds.page*${size},bounds.total) "end",
    (select coalesce(jsonb_agg(value order by position),'[]'::jsonb) from ranked where position>(bounds.page-1)*${size} and position<=bounds.page*${size}) items
   from source cross join bounds
  `);
        const row = result.rows[0];
        if (Number(row.revision) !== revision)
            return json({ error: "Expenses changed. Wait for the latest notebook revision." }, 409);
        return json({ ...row, totalAmount: Number(row.totalAmount) });
    } catch {
        return json({ error: "Expenses are temporarily unavailable. Please retry." }, 503);
    }
}
