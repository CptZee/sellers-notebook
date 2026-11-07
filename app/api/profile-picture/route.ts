import { withAccountUpload } from "../../../lib/account-lifecycle";
import { sessionUser, sameOrigin, json } from "../../../lib/api";
import { storage } from "../../../lib/storage";
import { deleteStoredObject } from "../../../lib/account-storage";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
    const user = await sessionUser(request);
    if (!user) return json({ error: "Sign in to view your picture." }, 401);
    try {
        const file = await storage().download(`profiles/${user.id}/avatar.webp`);
        return new Response(await file.arrayBuffer(), {
            headers: {
                "Content-Type": "image/webp",
                "Cache-Control": "private, no-store",
                "X-Content-Type-Options": "nosniff",
                "Content-Security-Policy": "default-src 'none'",
                Vary: "Cookie",
            },
        });
    } catch {
        return json({ error: "No profile picture found." }, 404);
    }
}
export async function PUT(request: Request) {
    const user = await sessionUser(request);
    if (!user) return json({ error: "Sign in to change your picture." }, 401);
    if (!sameOrigin(request)) return json({ error: "Cross-origin upload rejected." }, 403);
    if (
        request.headers.get("content-type") !== "image/webp" ||
        Number(request.headers.get("content-length")) > 1048576
    )
        return json({ error: "Use a WebP image up to 1 MB." }, 400);
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (
        bytes.length < 12 ||
        bytes.length > 1048576 ||
        new TextDecoder().decode(bytes.slice(0, 4)) !== "RIFF" ||
        new TextDecoder().decode(bytes.slice(8, 12)) !== "WEBP"
    )
        return json({ error: "Choose a valid image." }, 400);
    try {
        await withAccountUpload(user.id, async (client) => {
            await storage().upload(`profiles/${user.id}/avatar.webp`, bytes, {
                contentType: "image/webp",
                signal: AbortSignal.timeout(15000),
            });
        });
        return json({ uploaded: true });
    } catch {
        return json({ error: "Could not save your picture. Please retry." }, 503);
    }
}
export async function DELETE(request: Request) {
    const user = await sessionUser(request);
    if (!user) return json({ error: "Sign in again." }, 401);
    if (!sameOrigin(request)) return json({ error: "Cross-origin request rejected." }, 403);
    try {
        await withAccountUpload(user.id, async () => {
            await deleteStoredObject(`profiles/${user.id}/avatar.webp`);
        });
        return json({ deleted: true });
    } catch {
        return json({ error: "Could not remove your picture. Please retry." }, 503);
    }
}
