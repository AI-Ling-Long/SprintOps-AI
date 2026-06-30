// @vitest-environment node

import { describe, expect, it } from "vitest";

import { createEncryptedAuthStorage } from "./encrypted-auth-storage";

describe("encrypted auth storage", () => {
  it("restores persisted Supabase session values after app restart", async () => {
    let encryptedFile: string | null = null;
    const dependencies = {
      read: async () => encryptedFile,
      write: async (value: string) => {
        encryptedFile = value;
      },
      encrypt: (value: string) => Buffer.from(`encrypted:${value}`).toString("base64"),
      decrypt: (value: string) => Buffer.from(value, "base64").toString().replace(/^encrypted:/, ""),
    };
    const firstInstance = createEncryptedAuthStorage(dependencies);

    await firstInstance.setItem("supabase.auth.token", "session-value");

    const restartedInstance = createEncryptedAuthStorage(dependencies);
    await expect(restartedInstance.getItem("supabase.auth.token")).resolves.toBe("session-value");
  });
});
