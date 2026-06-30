import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

dotenv.config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)), quiet: true });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for migrations.");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10_000 });
try {
  await migrate(drizzle(pool), { migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)) });
  console.log("SprintOps database migrations applied.");
} finally {
  await pool.end();
}
