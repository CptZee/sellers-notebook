import { sql } from "drizzle-orm";
import { database } from "../../../../lib/db";
import { json } from "../../../../lib/api";
import { apiContext } from "../../../../lib/api-context";
import { accountDeleting } from "../../../../lib/account-lifecycle";
import { bearerToken, hashApiToken, readApiBody } from "../../../../lib/api-token.mjs";
import * as notebook from "../../notebook/route";
import * as inventory from "../../notebook/inventory/route";
import * as orders from "../../notebook/orders/route";
import * as expenses from "../../notebook/expenses/route";
import * as suppliers from "../../notebook/suppliers/route";
import * as record from "../../notebook/record/route";
import * as order from "../../notebook/order/route";
import * as purchase from "../../notebook/purchase/route";
import * as stock from "../../notebook/stock/route";
import * as overview from "../../notebook/overview/route";
import * as report from "../../notebook/report/route";
import * as manifest from "../../notebook/manifest/route";
export const dynamic = "force-dynamic";
type Handler = (request: Request) => Promise<Response>;
type Method = "GET" | "POST" | "PUT" | "PATCH";
const routes: Record<string, Partial<Record<Method, Handler>>> = {
    notebook,
    "notebook/inventory": inventory,
    "notebook/orders": orders,
    "notebook/expenses": expenses,
    "notebook/suppliers": suppliers,
    "notebook/record": record,
    "notebook/order": order,
    "notebook/purchase": purchase,
    "notebook/stock": stock,
    "notebook/overview": overview,
    "notebook/report": report,
    "notebook/manifest": manifest,
};
function cors(response: Response) {
    const headers = new Headers(response.headers);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
    headers.set("Access-Control-Expose-Headers", "Retry-After");
    headers.set("Cache-Control", "no-store");
    headers.set("Vary", "Authorization");
    return new Response(response.body, { status: response.status, headers });
}
export async function OPTIONS() {
    return cors(new Response(null, { status: 204 }));
}
async function dispatch(request: Request, context: { params: Promise<{ path: string[] }> }) {
    try {
        const path = (await context.params).path.join("/");
        const route = routes[path];
        if (!route) return cors(json({ error: "Unknown API resource." }, 404));
        const handler = route[request.method as Method];
        if (!handler) return cors(json({ error: "Method not allowed." }, 405));
        const token = bearerToken(request.headers.get("authorization"));
        if (!token) return cors(json({ error: "A Bearer API key is required." }, 401));
        // Atomic counter works across server instances; no in-memory rate-limit bypass.
        const result = await database().execute(sql`
            update seller_api_keys set
                request_count=case when window_start<=now()-interval '1 minute' then 1 else request_count+1 end,
                window_start=case when window_start<=now()-interval '1 minute' then now() else window_start end
            where token_hash=${hashApiToken(token)} and revoked_at is null and expires_at>now()
            returning owner_id,scope,request_count`);
        const key = result.rows[0];
        if (!key || (await accountDeleting(String(key.owner_id))))
            return cors(json({ error: "Invalid, expired or revoked API key." }, 401));
        if (Number(key.request_count) > 60) {
            const response = json({ error: "API rate limit exceeded. Retry in one minute." }, 429);
            response.headers.set("Retry-After", "60");
            return cors(response);
        }
        if (request.method !== "GET" && key.scope !== "write")
            return cors(json({ error: "This API key has read-only access." }, 403));
        const owner = String(key.owner_id);
        const profile = await database().execute(
            sql`select display_name from seller_notebooks where owner_id=${owner}`,
        );
        // Never forward browser cookies or identity hints to an API handler.
        const headers = new Headers(request.headers);
        headers.delete("cookie");
        headers.delete("x-notebook-user");
        const forwarded = new Request(request.url, {
            method: request.method,
            headers,
            ...(request.method !== "GET" ? { body: await readApiBody(request) } : {}),
        });
        return cors(
            await apiContext.run(
                {
                    id: owner,
                    name: String(profile.rows[0]?.display_name || "My notebook"),
                    email: "",
                    image: null,
                },
                () => handler(forwarded),
            ),
        );
    } catch (error) {
        if (error instanceof RangeError)
            return cors(json({ error: "API request body is too large." }, 413));
        return cors(json({ error: "API temporarily unavailable. Retry later." }, 503));
    }
}
export { dispatch as GET, dispatch as POST, dispatch as PUT, dispatch as PATCH };
