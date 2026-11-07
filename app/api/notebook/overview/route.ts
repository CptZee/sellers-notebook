import { sessionUser, json } from "../../../../lib/api";
import { database } from "../../../../lib/db";
import { sql } from "drizzle-orm";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
    const user = await sessionUser(request);
    if (!user) return json({ error: "Sign in to view your notebook overview." }, 401);
    const raw = new URL(request.url).searchParams.get("revision"),
        revision = raw === null ? null : Number(raw);
    if (revision !== null && (!Number.isSafeInteger(revision) || revision < 0))
        return json({ error: "Invalid notebook revision." }, 400);
    try {
        const result = await database().execute(sql`
  select coalesce((select revision from seller_notebooks where owner_id=${user.id}),0) revision,
   (select jsonb_build_object('units',coalesce(sum(stock),0),'value',coalesce(sum(stock*cost),0),'lowCount',count(*) filter(where stock<=coalesce(reorder_point,10))) from seller_products where owner_id=${user.id}) inventory,
   jsonb_build_object('count',(select count(*) from seller_suppliers where owner_id=${user.id}),
    'open',(select count(*) from seller_purchase_orders where owner_id=${user.id} and status in ('Ordered','Partially received')),
    'due',(select count(*) from seller_purchase_orders where owner_id=${user.id} and status in ('Ordered','Partially received') and expected_on<=(now() at time zone 'Asia/Manila')::date)) suppliers
 `);
        const data = result.rows[0];
        if (revision !== null && Number(data.revision) !== revision)
            return json({ error: "The notebook changed. Wait for the latest revision." }, 409);
        return json(data);
    } catch {
        return json({ error: "Could not load your overview. Please retry." }, 503);
    }
}
