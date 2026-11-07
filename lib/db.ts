import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema";
export function database() {
    return drizzle(neon(process.env.DATABASE_URL!), { schema });
}
