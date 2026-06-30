import { describe, expect, it } from "vitest";

import { AuthSessionSchema, PasswordCredentialsSchema } from "./index";

describe("password credentials", () => {
  it("rejects malformed credentials before they cross a process boundary", () => {
    const result = PasswordCredentialsSchema.safeParse({
      email: "not-an-email",
      password: "short",
    });

    expect(result.success).toBe(false);
  });
});

describe("public auth session", () => {
  it("never exposes a refresh token across the preload seam", () => {
    const session = AuthSessionSchema.parse({
      user: {
        id: "0ec58a71-9291-4b1a-a9b1-ea495998006e",
        email: "dev@example.com",
        displayName: "Dev User",
        avatarUrl: null,
      },
      expiresAt: 1_800_000_000,
      refreshToken: "must-not-cross",
    });

    expect(session).not.toHaveProperty("refreshToken");
  });
});
