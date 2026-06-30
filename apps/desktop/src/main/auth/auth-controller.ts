import {
  AuthSessionSchema,
  type AuthSession,
  type OAuthProvider,
  type PasswordCredentials,
  type SignUpCredentials,
  type SignUpResult,
} from "@sprintops/contracts";

export type AuthProviderSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number | null;
  user: {
    id: string;
    email: string;
    metadata: Record<string, unknown>;
  };
};

type ProviderSignUpResult = {
  session: AuthProviderSession | null;
  emailConfirmationRequired: boolean;
};

export type AuthProvider = {
  getSession: () => Promise<AuthProviderSession | null>;
  signInWithPassword: (credentials: PasswordCredentials) => Promise<AuthProviderSession | null>;
  signUp: (credentials: SignUpCredentials) => Promise<ProviderSignUpResult | null>;
  signInWithOAuth: (provider: OAuthProvider) => Promise<AuthProviderSession | null>;
  signOut: () => Promise<void>;
};

export class AuthControllerError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "AuthControllerError";
    this.code = code;
  }
}

function metadataString(metadata: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function toPublicSession(session: AuthProviderSession): AuthSession {
  const displayName =
    metadataString(session.user.metadata, ["full_name", "name", "user_name"]) ??
    session.user.email.split("@")[0] ??
    "Developer";

  return AuthSessionSchema.parse({
    user: {
      id: session.user.id,
      email: session.user.email,
      displayName,
      avatarUrl: metadataString(session.user.metadata, ["avatar_url", "picture"]),
    },
    expiresAt: session.expiresAt,
  });
}

function requireSession(session: AuthProviderSession | null): AuthProviderSession {
  if (!session) {
    throw new AuthControllerError("Authentication did not return a session.", "session_missing");
  }
  return session;
}

export function createAuthController(provider: AuthProvider) {
  return {
    async getSession(): Promise<AuthSession | null> {
      const session = await provider.getSession();
      return session ? toPublicSession(session) : null;
    },

    async getAccessToken(): Promise<string | null> {
      return (await provider.getSession())?.accessToken ?? null;
    },

    async signInWithPassword(credentials: PasswordCredentials): Promise<AuthSession> {
      return toPublicSession(requireSession(await provider.signInWithPassword(credentials)));
    },

    async signUp(credentials: SignUpCredentials): Promise<SignUpResult> {
      const result = await provider.signUp(credentials);
      if (!result) {
        throw new AuthControllerError("Account creation did not return a result.", "signup_result_missing");
      }

      return {
        session: result.session ? toPublicSession(result.session) : null,
        emailConfirmationRequired: result.emailConfirmationRequired,
      };
    },

    async signInWithOAuth(oauthProvider: OAuthProvider): Promise<AuthSession> {
      return toPublicSession(requireSession(await provider.signInWithOAuth(oauthProvider)));
    },

    async signOut(): Promise<void> {
      await provider.signOut();
    },
  };
}

export type AuthController = ReturnType<typeof createAuthController>;
