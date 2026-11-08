import { createHash, randomBytes } from "node:crypto";
export const hashApiToken = (token) => createHash("sha256").update(token).digest("hex");
export const createApiToken = () => `snb_${randomBytes(32).toString("hex")}`;
export async function readApiBody(request, limit = 4000000) {
    if (!request.body) return new Uint8Array();
    const reader = request.body.getReader(),
        chunks = [];
    let size = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) {
            void reader.cancel().catch(() => {});
            throw new RangeError("API request body is too large.");
        }
        chunks.push(value);
    }
    const result = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return result;
}
export function bearerToken(header) {
    const match = /^Bearer (snb_[a-f0-9]{64})$/i.exec(header || "");
    return match?.[1] || null;
}
export function keyInput(body) {
    if (
        !body ||
        typeof body.name !== "string" ||
        !body.name.trim() ||
        body.name.length > 80 ||
        !["public", "mobile"].includes(body.purpose) ||
        !["read", "write"].includes(body.scope)
    )
        throw Error("Provide a name, public or mobile purpose, and read or write scope.");
    return { name: body.name.trim(), purpose: body.purpose, scope: body.scope };
}
