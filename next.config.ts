import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
// Keep the interactive preview intact when a production build replaces .next.
export default function config(phase: string): NextConfig {
    return { distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next" };
}
