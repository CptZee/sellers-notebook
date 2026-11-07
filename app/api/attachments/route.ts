import { withAccountUpload } from "../../../lib/account-lifecycle";
import { reserveAttachment, settleFailedAttachment } from "../../../lib/account-storage";
import { eq, desc, and, isNull, or, lt } from "drizzle-orm";
import { encodeAttachmentCursor, decodeAttachmentCursor } from "../../../lib/attachment-cursor.mjs";
import { ownsAttachmentProduct } from "../../../lib/attachment-products";
import { database } from "../../../lib/db";
import { attachments, products } from "../../../db/schema";
import { sessionUser, json, sameOrigin } from "../../../lib/api";
import { storage } from "../../../lib/storage";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
    const user = await sessionUser(request);
    if (!user) return json({ error: "Sign in to view attachments." }, 401);
    const params = new URL(request.url).searchParams,
        productId = params.get("productId");
    if (productId && !(await ownsAttachmentProduct(user.id, productId)))
        return json({ error: "Product not found in your inventory." }, 404);
    const limit = Number(params.get("limit") || 25);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
        return json({ error: "Use a file-page size between 1 and 100." }, 400);
    let cursor;
    try {
        cursor = decodeAttachmentCursor(params.get("cursor"));
    } catch {
        return json({ error: "Invalid file-page cursor." }, 400);
    }
    const rows = await database()
        .select({
            id: attachments.id,
            filename: attachments.filename,
            size: attachments.size,
            productId: attachments.product_id,
            productName: products.name,
            productSku: products.sku,
            created_at: attachments.created_at,
        })
        .from(attachments)
        .leftJoin(
            products,
            and(
                eq(products.owner_id, attachments.owner_id),
                eq(products.id, attachments.product_id),
            ),
        )
        .where(
            and(
                eq(attachments.owner_id, user.id),
                productId
                    ? eq(attachments.product_id, productId)
                    : params.get("unlinked") === "1"
                      ? isNull(attachments.product_id)
                      : undefined,
                cursor
                    ? or(
                          lt(attachments.created_at, cursor.date),
                          and(
                              eq(attachments.created_at, cursor.date),
                              lt(attachments.id, cursor.id),
                          ),
                      )
                    : undefined,
            ),
        )
        .orderBy(desc(attachments.created_at), desc(attachments.id))
        .limit(limit + 1);
    const page = rows.slice(0, limit);
    return json({
        attachments: page,
        nextCursor:
            rows.length > limit && page.length
                ? encodeAttachmentCursor(page[page.length - 1])
                : null,
    });
}
export async function POST(request: Request) {
    const user = await sessionUser(request);
    if (!user) return json({ error: "Sign in to upload attachments." }, 401);
    if (!sameOrigin(request)) return json({ error: "Cross-origin upload rejected." }, 403);
    const productId = request.headers.get("x-product-id") || null;
    if (productId && !(await ownsAttachmentProduct(user.id, productId)))
        return json({ error: "Choose a saved product from your inventory." }, 400);
    const type = request.headers.get("content-type") || "";
    if (
        ![
            "application/pdf",
            "text/csv",
            "text/plain",
            "image/png",
            "image/jpeg",
            "image/webp",
        ].includes(type) ||
        Number(request.headers.get("content-length")) > 5 * 1024 * 1024
    )
        return json({ error: "Choose a PDF, image, CSV, or text file up to 5 MB." }, 400);
    let filename;
    try {
        filename = decodeURIComponent(request.headers.get("x-file-name") || "");
    } catch {
        return json({ error: "Invalid filename." }, 400);
    }
    if (!filename || filename.length > 200)
        return json({ error: "Use a filename of 1–200 characters." }, 400);
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (!bytes.length || bytes.length > 5 * 1024 * 1024)
        return json({ error: "Choose a nonempty file up to 5 MB." }, 400);
    const id = crypto.randomUUID(),
        key = `notebooks/${user.id}/${id}`;
    const files = storage();
    try {
        await reserveAttachment(user.id, id, key, bytes.length, user.name);
        await withAccountUpload(user.id, async (client) => {
            const reserved = await client.query(
                "select 1 from seller_storage_reservations where owner_id=$1 and id=$2 and object_key=$3 and bytes=$4",
                [user.id, id, key, bytes.length],
            );
            if (!reserved.rowCount) throw Error("Upload reservation unavailable.");
            await files.upload(key, bytes, {
                contentType: type,
                signal: AbortSignal.timeout(15000),
            });
            await client.query(
                "insert into seller_attachments(id,owner_id,object_key,filename,content_type,size,product_id) values($1,$2,$3,$4,$5,$6,$7)",
                [id, user.id, key, filename, type, bytes.length, productId],
            );
            await client.query(
                "delete from seller_storage_reservations where owner_id=$1 and id=$2",
                [user.id, id],
            );
        });
        return json({ id, filename }, 201);
    } catch (error) {
        console.warn("Attachment save failed.", {
            kind: error instanceof Error ? error.name : "Unknown",
            code:
                typeof error === "object" && error !== null && "code" in error
                    ? String(error.code)
                    : undefined,
        });
        try {
            if (await settleFailedAttachment(user.id, id)) return json({ id, filename }, 201);
        } catch {
            /* Keep the unresolved reservation until recovery can confirm cleanup. */
        }
        return json(
            {
                error: "Could not save this file. Reconnect and retry. Unfinished uploads can be cleared from Account settings → Notebook.",
            },
            503,
        );
    }
}
