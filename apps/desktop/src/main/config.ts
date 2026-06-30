import { resolve } from "node:path";

import dotenv from "dotenv";
import { z } from "zod";

const ConfigSchema = z.object({
  apiBaseUrl: z.url(),
  callbackPort: z.number().int().min(1024).max(65_535),
  supabase: z
    .object({
      url: z.url(),
      publishableKey: z.string().min(1),
    })
    .nullable(),
});

export type RuntimeConfig = z.infer<typeof ConfigSchema>;

function loadEnvironmentFiles(): void {
  const candidates = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "server/.env"),
    resolve(process.cwd(), "../../server/.env"),
  ];

  for (const path of candidates) {
    dotenv.config({ path, quiet: true });
  }
}

export function loadRuntimeConfig(): RuntimeConfig {
  loadEnvironmentFiles();

  const supabaseUrl = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
  const supabase = supabaseUrl && publishableKey ? { url: supabaseUrl, publishableKey } : null;

  return ConfigSchema.parse({
    apiBaseUrl: process.env.SPRINTOPS_API_BASE_URL ?? "http://127.0.0.1:3000",
    callbackPort: Number(process.env.SUPABASE_AUTH_CALLBACK_PORT ?? 39_177),
    supabase,
  });
}
