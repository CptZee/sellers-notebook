import { liveness } from "../../../lib/health.mjs";
export const dynamic = "force-dynamic";
export function GET() {
    return liveness();
}
