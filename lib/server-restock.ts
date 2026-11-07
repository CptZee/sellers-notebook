import { sql } from "drizzle-orm";
import { database } from "./db";
import { parseInventoryQuery } from "./inventory-query.mjs";
export function restockFilters(params: URLSearchParams) {
    const base = parseInventoryQuery(params),
        supplier = params.get("supplierId") || "all",
        view = params.get("view") || "All low-stock products";
    if (
        supplier.length > 100 ||
        !["All low-stock products", "Needs buying", "Covered by incoming stock"].includes(view)
    )
        throw Error("Invalid restock filters.");
    return { ...base, supplier, view, search: base.search.trim() };
}
export async function serverRestock(
    owner: string,
    f: ReturnType<typeof restockFilters>,
    complete = false,
) {
    const { page, size, search, supplier, view } = f;
    const result = await database().execute(sql`with incoming as (
  select i.product_id,sum(i.quantity-coalesce(i.received_quantity,0)) units from seller_purchase_items i join seller_purchase_orders p on p.owner_id=i.owner_id and p.id=i.purchase_id where i.owner_id=${owner} and p.status in ('Ordered','Partially received') group by i.product_id
 ), low as (
  select p.id,p.name,p.sku,p.stock,p.cost "unitCost",coalesce(p.reorder_point,10) "reorderPoint",coalesce(p.target_stock,greatest(20,coalesce(p.reorder_point,10)+1)) "targetStock",coalesce(i.units,0) "onOrder",
  coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'leadTimeDays',s.lead_time_days,'position',s.sort_order) order by s.sort_order) from seller_supplier_products l join seller_suppliers s on s.owner_id=l.owner_id and s.id=l.supplier_id where l.owner_id=p.owner_id and l.product_id=p.id),'[]'::jsonb) suppliers
  from seller_products p left join incoming i on i.product_id=p.id where p.owner_id=${owner} and p.stock<=coalesce(p.reorder_point,10)
 ), shortfalls as (select *,greatest(0,"targetStock"-stock) quantity from low),
 plan as (select *,greatest(0,quantity-"onOrder") "toBuy",floor("unitCost"::double precision*100+0.5)::numeric*quantity/100 "estimatedCost",floor("unitCost"::double precision*100+0.5)::numeric*greatest(0,quantity-"onOrder")/100 "buyEstimate" from shortfalls),
 matches as (select * from plan where position(lower(${search}) in lower(name||' '||sku))>0 and (${supplier}='all' or ${supplier}='unlinked' and jsonb_array_length(suppliers)=0 or exists(select 1 from jsonb_array_elements(suppliers) s where s->>'id'=${supplier})) and (${view}='All low-stock products' or ${view}='Needs buying' and "toBuy">0 or ${view}='Covered by incoming stock' and "toBuy"=0)),
 totals as (select count(*)::int total,coalesce(sum("onOrder"),0) incoming,coalesce(sum("toBuy"),0) quantity,coalesce(sum("buyEstimate"),0) estimate from matches),
 bounds as (select *,greatest(1,ceil(total::numeric/${size})::int) pages,least(${page},greatest(1,ceil(total::numeric/${size})::int)) page from totals)
 select coalesce((select revision from seller_notebooks where owner_id=${owner}),0) revision,(select count(*)::int from low) "lowCount",bounds.*,${size}::int "pageSize",(page-1)*${size} start,least(page*${size},total) "end",
 coalesce((select jsonb_agg(to_jsonb(r) order by stock,sku collate "en-US-x-icu") from (select * from matches order by stock,sku collate "en-US-x-icu",id limit ${complete ? 3000 : size} offset ${complete ? sql`0` : sql`(bounds.page-1)*${size}`}) r),'[]'::jsonb) items,
 coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name collate "en-US-x-icu",sort_order) from seller_suppliers where owner_id=${owner}),'[]'::jsonb) options from bounds`);
    return result.rows[0];
}
