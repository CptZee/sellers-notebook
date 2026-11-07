import { neon } from "@neondatabase/serverless";
import { readiness } from "../../../../lib/health.mjs";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: Request) {
    return readiness(request, {
        secret: process.env.HEALTH_CHECK_SECRET,
        probe: () =>
            neon(process.env.DATABASE_URL!, {
                fetchOptions: { signal: AbortSignal.timeout(5000), cache: "no-store" },
            })`SELECT 1`,
    });
}
