import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

import type { OAuthProvider, PasswordCredentials, SignUpCredentials } from "@sprintops/contracts";

import type { AuthProvider, AuthProviderSession } from "./auth-controller";
import type { EncryptedAuthStorage } from "./encrypted-auth-storage";
import { runOAuthFlow } from "./oauth-coordinator";

function mapSession(session: Session): AuthProviderSession {
  if (!session.user.email) throw new Error("The authenticated account has no email address.");

  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at ?? null,
    user: {
      id: session.user.id,
      email: session.user.email,
      metadata: session.user.user_metadata ?? {},
    },
  };
}

function friendlyAuthError(error: { message?: string; code?: string }): Error {
  const message = String(error.message ?? "").toLowerCase();
  if (message.includes("invalid login credentials") || error.code === "invalid_credentials") {
    return new Error("Email or password is incorrect.");
  }
  if (message.includes("email not confirmed")) {
    return new Error("Confirm your email address before signing in.");
  }
  if (message.includes("already") || message.includes("registered")) {
    return new Error("An account already exists for this email address.");
  }
  if (message.includes("rate limit")) {
    return new Error("Too many authentication attempts. Wait and try again.");
  }
  return new Error("Authentication failed. Try again.");
}

export function createSupabaseAuthProvider(options: {
  url: string;
  publishableKey: string;
  callbackPort: number;
  storage: EncryptedAuthStorage;
}): AuthProvider {
  const supabase: SupabaseClient = createClient(options.url, options.publishableKey, {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storage: options.storage,
    },
  });

  return {
    async getSession() {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw friendlyAuthError(error);
      return data.session ? mapSession(data.session) : null;
    },

    async signInWithPassword(credentials: PasswordCredentials) {
      const { data, error } = await supabase.auth.signInWithPassword(credentials);
      if (error) throw friendlyAuthError(error);
      return data.session ? mapSession(data.session) : null;
    },

    async signUp(credentials: SignUpCredentials) {
      const { data, error } = await supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
        options: { data: { name: credentials.name } },
      });
      if (error) throw friendlyAuthError(error);
      return {
        session: data.session ? mapSession(data.session) : null,
        emailConfirmationRequired: !data.session,
      };
    },

    async signInWithOAuth(provider: OAuthProvider) {
      try {
        const { data, error } = await runOAuthFlow(supabase, provider, options.callbackPort);
        if (error) throw error;
        return data.session ? mapSession(data.session) : null;
      } catch (error) {
        if (error instanceof Error && error.message.includes("timed out")) throw error;
        throw friendlyAuthError(error as { message?: string; code?: string });
      }
    },

    async signOut() {
      const { error } = await supabase.auth.signOut();
      if (error) throw friendlyAuthError(error);
    },
  };
}

export function createUnavailableAuthProvider(): AuthProvider {
  const unavailable = async (): Promise<never> => {
    throw new Error("Supabase authentication is not configured. Add the required environment variables and restart SprintOps.");
  };

  return {
    getSession: async () => null,
    signInWithPassword: unavailable,
    signUp: unavailable,
    signInWithOAuth: unavailable,
    signOut: async () => undefined,
  };
}
