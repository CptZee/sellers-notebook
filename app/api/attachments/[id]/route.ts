import { and, eq } from "drizzle-orm";
import { database } from "../../../../lib/db";
import { attachments } from "../../../../db/schema";
import { sessionUser, json, sameOrigin } from "../../../../lib/api";
import { storage } from "../../../../lib/storage";
import { ownsAttachmentProduct } from "../../../../lib/attachment-products";
import { withAccountUpload } from "../../../../lib/account-lifecycle";
import { deleteStoredObject } from "../../../../lib/account-storage";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
    const user = await sessionUser(request);
    if (!user) return json({ error: "Sign in to download attachments." }, 401);
    const { id } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "Not found." }, 404);
    const [row] = await database()
        .select()
        .from(attachments)
        .where(and(eq(attachments.id, id), eq(attachments.owner_id, user.id)));
    if (!row) return json({ error: "Not found." }, 404);
    const file = await storage().download(row.object_key);
    return new Response(await file.arrayBuffer(), {
        headers: {
            "Content-Type": row.content_type,
            "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(row.filename)}`,
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    });
}
export async function DELETE(request: Request, context: Context) {
    const user = await sessionUser(request);
    if (!user) return json({ error: "Sign in to delete attachments." }, 401);
    if (!sameOrigin(request)) return json({ error: "Cross-origin delete rejected." }, 403);
    const { id } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "Not found." }, 404);
    try {
        return await withAccountUpload(user.id, async (client) => {
            const row = (
                await client.query(
                    "select object_key from seller_attachments where id=$1 and owner_id=$2",
                    [id, user.id],
                )
            ).rows[0];
            if (!row) return json({ error: "Not found." }, 404);
            await deleteStoredObject(row.object_key);
            await client.query("delete from seller_attachments where id=$1 and owner_id=$2", [
                id,
                user.id,
            ]);
            return json({ deleted: true });
        });
    } catch {
        return json({ error: "Could not remove the file. Please retry." }, 503);
    }
}
export async function PATCH(request: Request, context: Context) {
    const user = await sessionUser(request);
    if (!user) return json({ error: "Sign in to link files." }, 401);
    if (!sameOrigin(request)) return json({ error: "Cross-origin update rejected." }, 403);
    const { id } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "Not found." }, 404);
    let body;
    try {
        const raw = await request.text();
        if (raw.length > 2000) return json({ error: "Invalid product link." }, 400);
        body = JSON.parse(raw);
    } catch {
        return json({ error: "Invalid JSON." }, 400);
    }
    if (
        !body ||
        !(body.productId === null || typeof body.productId === "string") ||
        (body.productId !== null && !(await ownsAttachmentProduct(user.id, body.productId)))
    )
        return json({ error: "Choose a saved product from your inventory." }, 400);
    const [updated] = await database()
        .update(attachments)
        .set({ product_id: body.productId })
        .where(and(eq(attachments.id, id), eq(attachments.owner_id, user.id)))
        .returning({ id: attachments.id, productId: attachments.product_id });
    return updated ? json(updated) : json({ error: "File not found." }, 404);
}
