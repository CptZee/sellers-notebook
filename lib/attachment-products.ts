import { and, eq, sql } from "drizzle-orm";
import { database } from "./db";
import { products } from "../db/schema";
export async function ownsAttachmentProduct(ownerId: string, productId: unknown) {
    if (typeof productId !== "string" || !productId || productId.length > 100) return false;
    const [row] = await database()
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.owner_id, ownerId), eq(products.id, productId)));
    return !!row;
}
