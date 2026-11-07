import { createHash, timingSafeEqual } from "node:crypto";
const response = (status, code = 200) =>
    Response.json(
        { status },
        { status: code, headers: { "Cache-Control": "no-store", Vary: "Authorization" } },
    );
export function liveness() {
    return response("ok");
}
export async function readiness(request, { secret, probe }) {
    if (typeof secret !== "string" || secret.length < 32) return response("unavailable", 503);
    const authorization = request.headers.get("authorization") || "";
    if (authorization.length > 1024 || !authorization.startsWith("Bearer "))
        return response("unauthorized", 401);
    const hash = (value) => createHash("sha256").update(value).digest();
    if (!timingSafeEqual(hash(authorization.slice(7)), hash(secret)))
        return response("unauthorized", 401);
    try {
        await probe();
        return response("ready");
    } catch {
        return response("unavailable", 503);
    }
}
