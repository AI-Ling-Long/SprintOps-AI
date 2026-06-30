import { createClient } from "@supabase/supabase-js";

import type { AuthVerifier } from "./app.js";

export function createSupabaseAuthVerifier(url: string, publishableKey: string): AuthVerifier {
  const client = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return {
    async verify(token) {
      const { data, error } = await client.auth.getUser(token);
      if (error || !data.user?.email) return null;
      const metadata = data.user.user_metadata ?? {};
      const displayName = [metadata.full_name, metadata.name, metadata.user_name]
        .find((value): value is string => typeof value === "string" && Boolean(value.trim()))?.trim() ?? data.user.email.split("@")[0] ?? "Developer";
      return { id: data.user.id, email: data.user.email, displayName };
    },
  };
}
