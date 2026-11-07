import { recordRows, readSavedNotebook } from "./relational-notebook";
import { sql } from "drizzle-orm";
import { database } from "./db";
import { notebooks } from "../db/schema";
import type { parseReportQuery } from "./report-query.mjs";
import type { Order, Product } from "./notebook-types";
export type BusinessReport = {
    revision: number;
    range: { from: string; to: string; error: string };
    summary: {
        revenue: number;
        orderCosts: number;
        orderProfit: number;
        overhead: number;
        netProfit: number;
    };
    refunds: number;
    chart: { from: string; to: string; revenue: number }[];
    channels: Record<string, number>;
    inventory: { value: number; units: number; products: number };
    counts: { received: number; processing: number; completed: number; all: number };
    recentOrders: Order[];
    lowProducts: Product[];
    lowCount: number;
    dueNow: number;
};
export async function businessReport(
    ownerId: string,
    filters: ReturnType<typeof parseReportQuery>,
): Promise<BusinessReport> {
    const { period, channel, today, range } = filters;
    // Every aggregate reads the same statement snapshot. No full document is returned.
    const rows = await database().execute(sql`
 with source as (
  select coalesce((select revision from ${notebooks} where owner_id=${ownerId}),0) revision
 ), orders as (
  select value,ordinality,value->>'id' id,value->>'date' date,value->>'status' status,value->>'channel' channel,
   floor(((value->>'price')::double precision*(value->>'quantity')::double precision)*100+0.5)::numeric revenue,
   floor((((value->>'cost')::double precision*(value->>'quantity')::double precision+
    ((value->>'price')::double precision*(value->>'quantity')::double precision)*(value->>'fee')::double precision/100+
    (value->>'packaging')::double precision+(value->>'shipping')::double precision)*100)+0.5)::numeric cost
  from source,${recordRows(ownerId, "orders")} records
 ), expenses as (
  select value->>'date' date,value->>'channel' channel,floor((value->>'amount')::double precision*100+0.5)::numeric amount
  from source,${recordRows(ownerId, "expenses")} records
 ), refunds as (
  select value->>'date' date,value->>'orderId' order_id,floor((value->>'amount')::double precision*100+0.5)::numeric amount
  from source,${recordRows(ownerId, "refundRecords")} records
 ), products as (
  select value,ordinality,(value->>'stock')::double precision stock,(value->>'cost')::double precision cost,
   coalesce((value->>'reorderPoint')::double precision,10) alert
  from source,${recordRows(ownerId, "products")} records
 ), bounds as (
  select (case when ${period}='all' then coalesce((select min(date) from (
   select date from orders union all select date from expenses union all select date from refunds
  ) dates where date<=${today}),${today}) else ${range.from} end)::date first,${range.to}::date last
 ), selected as (
  select orders.* from orders,bounds where date>=first::text and date<=last::text and (${channel}='All channels' or channel=${channel})
 ), totals as (
  select coalesce(sum(revenue) filter(where status='Completed'),0) revenue,
   coalesce(sum(cost) filter(where status='Completed'),0) cost,
   count(*)::int all_count,count(*) filter(where status<>'Cancelled')::int received,
   count(*) filter(where status='Processing')::int processing,count(*) filter(where status='Completed')::int completed from selected
 ), overhead as (
  select coalesce(sum(amount),0) amount from expenses,bounds where date>=first::text and date<=last::text and (${channel}='All channels' or channel=${channel})
 ), refunded as (
  select coalesce(sum(refunds.amount),0) amount from refunds join orders on orders.id=refunds.order_id cross join bounds
  where refunds.date>=first::text and refunds.date<=last::text and (${channel}='All channels' or orders.channel=${channel})
 ), bucket_size as (select *,greatest(1,ceil((last-first+1)/14.0)::int) size from bounds),
 buckets as (
  select first+i*size first,least(last,first+(i+1)*size-1) last from bucket_size,
  lateral generate_series(0,ceil((last-first+1)::numeric/size)::int-1) i
 )
 select source.revision,
  jsonb_build_object('from',bounds.first::text,'to',bounds.last::text,'error','') range,
  jsonb_build_object('revenue',totals.revenue/100,'orderCosts',totals.cost/100,'orderProfit',(totals.revenue-totals.cost)/100,'overhead',overhead.amount/100,'netProfit',(totals.revenue-totals.cost-overhead.amount-refunded.amount)/100) summary,
  refunded.amount/100 refunds,
  (select coalesce(jsonb_agg(jsonb_build_object('from',b.first::text,'to',b.last::text,'revenue',coalesce((select sum(revenue)/100 from selected where status='Completed' and date>=b.first::text and date<=b.last::text),0)) order by b.first),'[]'::jsonb) from buckets b) chart,
  (select jsonb_object_agg(c,coalesce((select sum(revenue)/100 from selected where status='Completed' and channel=c),0)) from unnest(array['Shopee','Lazada','TikTok Shop','Direct']) c) channels,
  (select jsonb_build_object('value',coalesce(sum(stock*cost),0),'units',coalesce(sum(stock),0),'products',count(*)) from products) inventory,
  jsonb_build_object('all',totals.all_count,'received',totals.received,'processing',totals.processing,'completed',totals.completed) counts,
  (select coalesce(jsonb_agg(value order by ordinality),'[]'::jsonb) from (select value,ordinality from selected order by ordinality limit 5) recent) "recentOrders",
  (select coalesce(jsonb_agg(value order by ordinality),'[]'::jsonb) from (select value,ordinality from products where stock<=alert order by ordinality limit 3) low) "lowProducts",
  (select count(*)::int from products where stock<=alert) "lowCount",
  (select count(*)::int from ${recordRows(ownerId, "purchaseOrders")} p where p.value->>'status' in ('Ordered','Partially received') and p.value->>'expectedDate'<>'' and p.value->>'expectedDate'<=${today}) "dueNow"
 from source cross join bounds cross join totals cross join overhead cross join refunded
 `);
    const row = rows.rows[0] as unknown as BusinessReport;
    // Numeric aggregate scalars can be strings with the HTTP driver.
    return { ...row, refunds: Number(row.refunds), revision: Number(row.revision) };
}
