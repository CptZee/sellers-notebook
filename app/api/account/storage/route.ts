import { sessionUser, json, sameOrigin } from "../../../../lib/api";
import { readAccountStorage, recoverStorage } from "../../../../lib/account-storage";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
    const user = await sessionUser(request);
    if (!user) return json({ error: "Sign in to check storage." }, 401);
    try {
        return json(await readAccountStorage(user.id));
    } catch {
        return json({ error: "Could not check storage. Please retry." }, 503);
    }
}
export async function POST(request: Request) {
    const user = await sessionUser(request);
    if (!user) return json({ error: "Sign in to recover storage." }, 401);
    if (!sameOrigin(request)) return json({ error: "Cross-origin request rejected." }, 403);
    let body;
    try {
        const raw = await request.text();
        if (raw.length > 200) throw Error();
        body = JSON.parse(raw);
    } catch {
        return json({ error: "Invalid recovery request." }, 400);
    }
    if (!body || Object.keys(body).length !== 1 || body.action !== "recover")
        return json({ error: "Only unfinished-upload recovery is available here." }, 400);
    try {
        return json(await recoverStorage(user.id));
    } catch {
        return json({ error: "Could not clear unfinished uploads. Please retry." }, 503);
    }
}
