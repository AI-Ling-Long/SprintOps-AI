import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import * as schema from "./schema.js";

export function createDatabase(connectionString: string) {
  const pool = new pg.Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000 });
  return { pool, database: drizzle(pool, { schema }) };
}
