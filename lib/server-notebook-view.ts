import { recordRows, readSavedNotebook } from "./relational-notebook";
import { sql } from "drizzle-orm";
import { database } from "./db";
import { notebooks } from "../db/schema";
import type { parseNotebookView } from "./notebook-view-query.mjs";
export async function notebookView(owner: string, filters: ReturnType<typeof parseNotebookView>) {
    const { kind, revision, page, size, search, status, supplierId, parent, id, today, financial } =
        filters;
    const purchaseKinds = ["purchases", "reminders", "statements"].includes(kind);
    const purchaseSql = sql`
 , base as (select p.value,p.ordinality,p.value->>'id' id,p.value->>'status' status,p.value->>'supplierId' supplier_id,coalesce(p.value->>'expectedDate','') expected,
  concat_ws(' ',p.value->>'reference',p.value->>'supplierName')||coalesce((select ' '||string_agg((i->>'productName')||' '||(i->>'sku'),' ' order by n) from jsonb_array_elements(p.value->'items') with ordinality a(i,n)),'') searchable,
  (p.value->>'status' in ('Ordered','Partially received')) active,
  coalesce((select sum((i->>'quantity')::numeric-coalesce((i->>'receivedQuantity')::numeric,case when p.value->>'status'='Received' then (i->>'quantity')::numeric else 0 end)) from jsonb_array_elements(p.value->'items') i),0) quantity,
  coalesce((select sum(round((i->>'unitCost')::numeric*100)*(i->>'quantity')::numeric) from jsonb_array_elements(p.value->'items') i),0) original,
  coalesce((select sum(round((i->>'unitCost')::numeric*100)*coalesce((i->>'receivedQuantity')::numeric,0)) from jsonb_array_elements(p.value->'items') i),0) received_cost,
  coalesce((select sum(round((i->>'unitCost')::numeric*100)*((i->>'quantity')::numeric-coalesce((i->>'receivedQuantity')::numeric,case when p.value->>'status'='Received' then (i->>'quantity')::numeric else 0 end))) from jsonb_array_elements(p.value->'items') i),0) outstanding,
  coalesce((select sum(round((r->>'amount')::numeric*100)) from jsonb_array_elements(coalesce(p.value->'payments','[]'::jsonb)) r),0) paid,
  coalesce((select sum(round((r->>'amount')::numeric*100)) from jsonb_array_elements(coalesce(p.value->'supplierRefunds','[]'::jsonb)) r),0) cancel_refunded,
  coalesce((select sum(round(amount*100)) from seller_goods_return_refunds f where f.owner_id=${owner} and f.purchase_id=p.id),0) return_refunded,
  coalesce((select sum(round(i.unit_cost*100)*i.quantity) from seller_purchase_goods_return_items i join seller_purchase_goods_returns g on g.owner_id=i.owner_id and g.purchase_id=i.purchase_id and g.id=i.return_id where i.owner_id=${owner} and i.purchase_id=p.id and g.voided_at is null),0) returned
  from source,${recordRows(owner, "purchaseOrders")} p
 ), purchases as (select *,case when status='Cancelled' then received_cost else original end-returned item_cost,cancel_refunded+return_refunded refunded,
  case when expected='' then 'No date set' when expected<${today} then 'Overdue' when expected=${today} then 'Due today' when expected::date<=${today}::date+7 then 'Next 7 days' else 'Later' end category from base),
 matches as (select * from purchases where (${id}='' or purchases.id=${id}) and (${supplierId}='all' or supplier_id=${supplierId}) and position(lower(${search}) in lower(searchable))>0 and (${financial}='' or ${financial}='payment' and purchases.status<>'Cancelled' and greatest(0,least(original-paid,case when returned>0 then item_cost-paid+refunded else original-paid end))>0 and jsonb_array_length(coalesce(value->'payments','[]'::jsonb))<100 or ${financial}='supplier-refund' and purchases.status='Cancelled' and paid-cancel_refunded>received_cost and jsonb_array_length(coalesce(value->'supplierRefunds','[]'::jsonb))<100) and
  (${kind}='purchases' and (${status}='All purchases' or (${status}='Overdue' and active and expected<>'' and expected<${today}) or purchases.status=${status}) or ${kind}='reminders' and active and (${status}='All open' or category=${status}) or ${kind}='statements' and (${status}='All statuses' or purchases.status=${status}))),
 entries as (select *,case when ${kind}='purchases' then (value-'payments'-'supplierRefunds'-'goodsReturns'-'goodsReturnRefunds')||jsonb_build_object('financial',jsonb_build_object('originalTotal',original/100,'itemTotal',item_cost/100,'paid',paid/100,'refunded',refunded/100,'netPaid',(paid-refunded)/100,'balance',greatest(0,item_cost-paid+refunded)/100,'credit',greatest(0,paid-refunded-item_cost)/100,'recordable',greatest(0,least(original-paid,case when returned>0 then item_cost-paid+refunded else original-paid end))/100)||case when returned>0 then jsonb_build_object('cancellationCredit',greatest(0,paid-received_cost-cancel_refunded)/100) else '{}'::jsonb end) when ${kind}='reminders' then jsonb_build_object('id',id,'reference',value->>'reference','supplierId',supplier_id,'supplierName',value->>'supplierName','expectedDate',expected,'status',status,'category',category,'quantity',quantity,'cost',outstanding/100) else jsonb_build_object('id',id,'reference',value->>'reference','supplierId',supplier_id,'supplierName',value->>'supplierName','date',to_char((value->>'createdAt')::timestamptz at time zone 'Asia/Manila','YYYY-MM-DD'),'status',status,'originalTotal',original/100,'itemTotal',item_cost/100,'paid',paid/100,'refunded',refunded/100,'netPaid',(paid-refunded)/100,'balance',greatest(0,item_cost-paid+refunded)/100,'credit',greatest(0,paid-refunded-item_cost)/100,'recordable',greatest(0,least(original-paid,case when returned>0 then item_cost-paid+refunded else original-paid end))/100) end row from matches),
 ranked as (select row,row_number() over(order by case when ${kind}='reminders' then coalesce(nullif(expected,''),'9999-12-31') end asc,
  case when ${kind}<>'reminders' then value->>'createdAt' end desc,
  case when ${kind} in ('reminders','statements') then value->>'reference' end collate "en-US-x-icu" asc,ordinality asc) position from entries),
 aggregates as (select jsonb_build_object('openCount',count(*) filter(where active),'outstandingUnits',coalesce(sum(quantity) filter(where active),0),'outstandingCost',coalesce(sum(outstanding) filter(where active),0)/100,'overdueCount',count(*) filter(where active and expected<>'' and expected<${today}),'quantity',coalesce(sum(quantity),0),'originalTotal',coalesce(sum(original),0)/100,'itemTotal',coalesce(sum(item_cost),0)/100,'paid',coalesce(sum(paid),0)/100,'refunded',coalesce(sum(refunded),0)/100,'netPaid',coalesce(sum(paid-refunded),0)/100,'balance',coalesce(sum(greatest(0,item_cost-paid+refunded)),0)/100,'credit',coalesce(sum(greatest(0,paid-refunded-item_cost)),0)/100) totals from matches),
 extra as (select jsonb_build_object('Overdue',count(*) filter(where category='Overdue'),'Due today',count(*) filter(where category='Due today'),'Next 7 days',count(*) filter(where category='Next 7 days'),'Later',count(*) filter(where category='Later'),'No date set',count(*) filter(where category='No date set')) counts from purchases where active),
 supplier_options as (select distinct on(sid) sid,name,archived,priority,position from (
  select value->>'id' sid,value->>'name' name,false archived,0 priority,ordinality position from source,${recordRows(owner, "suppliers")} records where ${kind}<>'reminders'
  union all select supplier_id,value->>'supplierName',true,1,ordinality from purchases where ${kind}<>'reminders' or active
 ) all_options order by sid,priority,position),
 options as (select coalesce(jsonb_agg(jsonb_build_object('id',sid,'name',name,'archived',archived) order by name collate "en-US-x-icu",priority,position),'[]'::jsonb) items from supplier_options)
 `;
    const collection =
        kind === "stock"
            ? "stockAdjustments"
            : kind === "refunds"
              ? "refundRecords"
              : kind === "payments"
                ? "payments"
                : "supplierRefunds";
    const historySql = sql`
 , selected_order as (select value from source,${recordRows(owner, "orders")} records where value->>'id'=${parent}),
 entries as (${["stock", "refunds"].includes(kind) ? sql`select h.value row,h.ordinality from ${recordRows(owner, collection)} h where position(lower(${search}) in lower(h.value::text))>0 and (${parent}='' or ${kind}='stock' and h.value->>'productId'=${parent} or ${kind}='refunds' and exists(select 1 from ${recordRows(owner, "orders")} o cross join selected_order so where o.value->>'id'=h.value->>'orderId' and (o.value->>'id'=so.value->>'id' or coalesce(so.value->>'sourceOrderId','')<>'' and o.value->>'channel'=so.value->>'channel' and upper(trim(o.value->>'sourceOrderId'))=upper(trim(so.value->>'sourceOrderId')))))` : sql`select h.value row,h.ordinality from ${recordRows(owner, collection)} h where h.purchase_id=${parent} and position(lower(${search}) in lower(h.value::text))>0`}),
 ranked as (select row,row_number() over(order by ordinality) position from entries),
 aggregates as (select jsonb_build_object('amount',coalesce(sum(coalesce((row->>'amount')::numeric,0)),0)) totals from entries),extra as (select '{}'::jsonb counts),options as (select '[]'::jsonb items)
 `;
    const result = await database()
        .execute(sql`with source as (select coalesce((select revision from ${notebooks} where owner_id=${owner}),0) revision)
 ${purchaseKinds ? purchaseSql : historySql}, total as (select count(*)::int total from ranked),bounds as (select *,greatest(1,ceil(total::numeric/${size})::int) pages,least(${page},greatest(1,ceil(total::numeric/${size})::int)) page from total)
 select source.revision,bounds.total,bounds.pages,bounds.page,${size}::int "pageSize",(bounds.page-1)*${size} start,least(bounds.page*${size},bounds.total) "end",aggregates.totals,extra.counts,options.items options,
 (select coalesce(jsonb_agg(row order by position),'[]'::jsonb) from ranked where position>(bounds.page-1)*${size} and position<=bounds.page*${size}) items from source cross join bounds cross join aggregates cross join extra cross join options`);
    const row = result.rows[0];
    return { stale: Number(row.revision) !== revision, data: row };
}
