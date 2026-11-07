import { redirect } from "next/navigation";
import { auth } from "../../lib/auth/server";
import NotebookDashboard from "../../components/notebook-dashboard";
export const dynamic = "force-dynamic";
export default async function NotebookPage() {
    const { data } = await auth.getSession();
    if (!data?.user) redirect("/auth/sign-in");
    return <NotebookDashboard />;
}
