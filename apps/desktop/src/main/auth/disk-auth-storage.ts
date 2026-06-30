import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";

import { app, safeStorage } from "electron";

import { createEncryptedAuthStorage, type EncryptedAuthStorage } from "./encrypted-auth-storage";

export function createDiskAuthStorage(): EncryptedAuthStorage {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Secure authentication storage is unavailable on this device.");
  }

  const storagePath = join(app.getPath("userData"), "auth-session.bin");

  return createEncryptedAuthStorage({
    async read() {
      try {
        return await fs.readFile(storagePath, "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },
    async write(value) {
      const temporaryPath = `${storagePath}.tmp`;
      await fs.mkdir(dirname(storagePath), { recursive: true });
      await fs.writeFile(temporaryPath, value, { encoding: "utf8", mode: 0o600 });
      await fs.rename(temporaryPath, storagePath);
    },
    encrypt(value) {
      return safeStorage.encryptString(value).toString("base64");
    },
    decrypt(value) {
      return safeStorage.decryptString(Buffer.from(value, "base64"));
    },
  });
}
