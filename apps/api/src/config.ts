import { resolve } from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

for (const path of [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../../.env")]) dotenv.config({ path, quiet: true });

const ConfigSchema = z.object({
  port: z.coerce.number().int().min(1).max(65535).default(3000),
  host: z.string().min(1).default("0.0.0.0"),
  databaseUrl: z.string().min(1),
  supabaseUrl: z.url(),
  supabasePublishableKey: z.string().min(1),
  invitationBaseUrl: z.url(),
  corsOrigin: z.string().optional(),
});

export function loadApiConfig() {
  return ConfigSchema.parse({
    port: process.env.PORT,
    host: process.env.HOST,
    databaseUrl: process.env.DATABASE_URL,
    supabaseUrl: process.env.SUPABASE_URL,
    supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY,
    invitationBaseUrl: process.env.SPRINTOPS_INVITATION_BASE_URL ?? "http://127.0.0.1:3000",
    corsOrigin: process.env.SPRINTOPS_CORS_ORIGIN,
  });
}
