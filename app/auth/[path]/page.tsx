import { notFound } from "next/navigation";
import { AuthForm } from "../../../components/auth-form";
export default async function AuthPage({
    params,
    searchParams,
}: {
    params: Promise<{ path: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const { path } = await params;
    if (!["sign-in", "sign-up", "forgot-password", "reset-password", "verify-email"].includes(path))
        notFound();
    const query = await searchParams;
    const token = typeof query.token === "string" && query.token.length <= 2048 ? query.token : "";
    return (
        <AuthForm
            key={path}
            path={path}
            resetToken={token}
            resetLinkError={!!query.error}
            socialError={query.oauth_error === "google"}
        />
    );
}
