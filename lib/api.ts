import { accountDeleting } from "./account-lifecycle";
import { auth } from "./auth/server";
import { apiContext } from "./api-context";
export async function sessionUser(request: Request) {
    const apiUser = apiContext.getStore();
    if (apiUser) return (await accountDeleting(apiUser.id)) ? null : apiUser;
    const { data } = await auth.getSession();
    const user = data?.user;
    if (!user) return null;
    if (await accountDeleting(user.id)) return null;
    const expected = request.headers.get("X-Notebook-User");
    if (expected && expected !== user.id) return null;
    return {
        id: user.id,
        name: user.name || user.email.split("@")[0],
        email: user.email,
        image: user.image || null,
    };
}
export const json = (data: unknown, status = 200) => {
    const body = JSON.stringify(data);
    return new Response(body, {
        status,
        headers: {
            "Content-Type": "application/json",
            "Content-Length": String(new TextEncoder().encode(body).length),
            "Cache-Control": "no-store",
            Vary: "Cookie",
        },
    });
};
export function sameOrigin(request: Request) {
    if (apiContext.getStore()) return true;
    // Next may use an internal hostname in request.url. Host retains the browser's
    // authority; browsers cannot override it when sending a cross-origin request.
    try {
        const incoming = new URL(request.headers.get("origin") || "");
        const protocol =
            request.headers.get("x-forwarded-proto") || new URL(request.url).protocol.slice(0, -1);
        const expected = new URL(
            `${protocol}://${request.headers.get("host") || new URL(request.url).host}`,
        );
        return incoming.origin === expected.origin;
    } catch {
        return false;
    }
}
