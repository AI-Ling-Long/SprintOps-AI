// @vitest-environment node

import { describe, expect, it } from "vitest";

import { createAuthController, type AuthProvider } from "./auth-controller";

describe("auth controller", () => {
  it("restores a public session without exposing provider tokens", async () => {
    const provider: AuthProvider = {
      getSession: async () => ({
        accessToken: "access-token",
        refreshToken: "refresh-token",
        expiresAt: 1_800_000_000,
        user: {
          id: "0ec58a71-9291-4b1a-a9b1-ea495998006e",
          email: "dev@example.com",
          metadata: { full_name: "Dev User", avatar_url: null },
        },
      }),
      signInWithPassword: async () => null,
      signUp: async () => null,
      signInWithOAuth: async () => null,
      signOut: async () => undefined,
    };

    const auth = createAuthController(provider);

    await expect(auth.getSession()).resolves.toEqual({
      user: {
        id: "0ec58a71-9291-4b1a-a9b1-ea495998006e",
        email: "dev@example.com",
        displayName: "Dev User",
        avatarUrl: null,
      },
      expiresAt: 1_800_000_000,
    });
    await expect(auth.getAccessToken()).resolves.toBe("access-token");
  });
});
