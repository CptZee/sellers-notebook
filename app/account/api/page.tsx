import { redirect } from "next/navigation";
import { auth } from "../../../lib/auth/server";
import { ApiKeys } from "../../../components/api-keys";
export const dynamic = "force-dynamic";
export default async function ApiAccess() {
    const { data } = await auth.getSession();
    if (!data?.user) redirect("/auth/sign-in");
    return (
        <main className="api-access">
            <section className="api-access-panel">
                <span className="api-access-eyebrow">DEVELOPER SETTINGS</span>
                <h1>API access</h1>
                <p>
                    Connect your own integration or mobile device to your notebook. Each key belongs
                    to your account and expires after 90 days.
                </p>
                <p>
                    <a href="/developers">API documentation</a> ·{" "}
                    <a href="/account">Back to account</a>
                </p>
                <ApiKeys />
            </section>
        </main>
    );
}
