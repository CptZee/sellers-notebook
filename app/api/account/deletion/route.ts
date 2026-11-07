import { auth } from "../../../../lib/auth/server";
import { json, sameOrigin } from "../../../../lib/api";
import {
    deletionConfig,
    validDeletionRequest,
    validResumeToken,
} from "../../../../lib/account-deletion.mjs";
import { prepareAccountDeletion, advanceAccountDeletion } from "../../../../lib/delete-account";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET() {
    try {
        const { data } = await auth.getSession();
        return data?.user
            ? json({
                  available: process.env.ACCOUNT_DELETION_ENABLED === "true" && !!deletionConfig(),
                  email: data.user.email,
              })
            : json({ error: "Sign in to delete your account." }, 401);
    } catch {
        return json({ error: "Account settings are unavailable. Please retry." }, 503);
    }
}
export async function POST(request: Request) {
    try {
        if (!sameOrigin(request)) return json({ error: "Cross-origin request rejected." }, 403);
        const { data } = await auth.getSession();
        if (
            !data?.user ||
            (request.headers.get("X-Notebook-User") &&
                request.headers.get("X-Notebook-User") !== data.user.id)
        )
            return json({ error: "Sign in again to confirm account deletion." }, 401);
        if (process.env.ACCOUNT_DELETION_ENABLED !== "true" || !deletionConfig())
            return json(
                { error: "Account deletion is not available yet. Your data has not been changed." },
                503,
            );
        const raw = await request.text();
        if (raw.length > 4000) return json({ error: "Invalid deletion request." }, 400);
        let body;
        try {
            body = JSON.parse(raw);
        } catch {
            return json({ error: "Invalid deletion request." }, 400);
        }
        if (!validDeletionRequest(body))
            return json(
                {
                    error: "Enter your current password, type DELETE, and acknowledge permanent deletion.",
                },
                400,
            );
        const verified = await auth.handler().POST(
            new Request(request.url, {
                method: "POST",
                headers: request.headers,
                body: JSON.stringify({ password: body.password }),
            }),
            { params: Promise.resolve({ path: ["verify-password"] }) },
        );
        if (!verified.ok)
            return json(
                {
                    error:
                        verified.status === 429
                            ? "Too many password attempts. Wait and retry."
                            : "Could not verify your password. Check it and retry.",
                },
                verified.status === 429 ? 429 : 400,
            );
        const result = await verified.json();
        if (result.status !== true) return json({ error: "Could not verify your password." }, 400);
        return json(await prepareAccountDeletion(data.user.id));
    } catch (error) {
        return json({ error: "Could not prepare deletion. Keep this page open and retry." }, 503);
    }
}
export async function DELETE(request: Request) {
    try {
        if (!sameOrigin(request)) return json({ error: "Cross-origin request rejected." }, 403);
        const token = request.headers.get("X-Account-Deletion-Token");
        if (!validResumeToken(token)) return json({ error: "Invalid deletion receipt." }, 401);
        const raw = await request.text();
        if (raw.length > 200) return json({ error: "Invalid deletion receipt." }, 400);
        let body;
        try {
            body = JSON.parse(raw);
        } catch {
            return json({ error: "Invalid deletion receipt." }, 400);
        }
        if (
            !body ||
            Object.keys(body).some((k) => k !== "id") ||
            typeof body.id !== "string" ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id)
        )
            return json({ error: "Invalid deletion receipt." }, 400);
        const result = await advanceAccountDeletion(body.id, token!);
        return result ? json(result) : json({ error: "Invalid deletion receipt." }, 401);
    } catch {
        return json(
            {
                error: "Deletion paused. Keep this page open and retry to finish removing the remaining data.",
            },
            503,
        );
    }
}
