import { auth } from "../../lib/auth/server";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function Account() {
    const { data } = await auth.getSession();
    if (!data?.user) redirect("/auth/sign-in");
    return (
        <main className="auth-page">
            <section className="card auth-card">
                <h1>Your notebook account</h1>
                <p>{data.user.name}</p>
                <p>{data.user.email}</p>
                <p>
                    <a href="/account/api">Manage API access</a>
                </p>
                <a
                    className="button primary"
                    href="/notebook"
                >
                    Open my notebook
                </a>
            </section>
        </main>
    );
}
