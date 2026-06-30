import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";

dotenv.config({ path: "../../.env", quiet: true });
dotenv.config({ path: ".env", quiet: true });

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for database commands.");

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL },
});
