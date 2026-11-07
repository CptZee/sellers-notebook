import { createHash, timingSafeEqual } from "node:crypto";
export const resumeHash = (value) => createHash("sha256").update(value).digest("hex");
export function validDeletionRequest(body) {
    return (
        !!body &&
        typeof body === "object" &&
        !Array.isArray(body) &&
        Object.keys(body).every((k) => ["password", "confirmation", "acknowledged"].includes(k)) &&
        typeof body.password === "string" &&
        body.password.length > 0 &&
        body.password.length <= 1024 &&
        body.confirmation === "DELETE" &&
        body.acknowledged === true
    );
}
export function validResumeToken(token) {
    return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}
export function matchesResume(token, hash) {
    return (
        validResumeToken(token) &&
        typeof hash === "string" &&
        /^[a-f0-9]{64}$/.test(hash) &&
        timingSafeEqual(Buffer.from(resumeHash(token), "hex"), Buffer.from(hash, "hex"))
    );
}
export function deletionConfig(env = process.env) {
    const key = env.NEON_ACCOUNT_DELETION_API_KEY,
        project = env.NEON_ACCOUNT_DELETION_PROJECT_ID,
        branch = env.NEON_ACCOUNT_DELETION_BRANCH_ID;
    return key &&
        /^\S{10,}$/.test(key) &&
        /^[-a-z0-9]{1,100}$/.test(project || "") &&
        /^br-[-a-z0-9]{1,100}$/.test(branch || "")
        ? {
              key,
              base: `https://console.neon.tech/api/v2/projects/${project}/branches/${branch}/auth`,
          }
        : null;
}
export function ownsDeletionKey(owner, key) {
    return (
        typeof owner === "string" &&
        /^[A-Za-z0-9_-]{1,100}$/.test(owner) &&
        typeof key === "string" &&
        !key.includes("\\") &&
        !key.split("/").some((part) => part === "." || part === "..") &&
        (key.startsWith(`notebooks/${owner}/`) || key.startsWith(`profiles/${owner}/`))
    );
}
