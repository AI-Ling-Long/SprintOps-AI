type EncryptedAuthStorageDependencies = {
  read: () => Promise<string | null>;
  write: (value: string) => Promise<void>;
  encrypt: (value: string) => string;
  decrypt: (value: string) => string;
};

type StoredValues = Record<string, string>;

export function createEncryptedAuthStorage(dependencies: EncryptedAuthStorageDependencies) {
  let values: StoredValues | null = null;
  let updateQueue = Promise.resolve();

  const load = async (): Promise<StoredValues> => {
    if (values) return values;

    const encrypted = await dependencies.read();
    if (!encrypted) {
      values = {};
      return values;
    }

    const parsed: unknown = JSON.parse(dependencies.decrypt(encrypted));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("The encrypted authentication store is invalid.");
    }

    values = Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
    return values;
  };

  const mutate = (operation: (current: StoredValues) => void): Promise<void> => {
    updateQueue = updateQueue.then(async () => {
      const current = await load();
      operation(current);
      await dependencies.write(dependencies.encrypt(JSON.stringify(current)));
    });
    return updateQueue;
  };

  return {
    async getItem(key: string): Promise<string | null> {
      await updateQueue;
      return (await load())[key] ?? null;
    },

    setItem(key: string, value: string): Promise<void> {
      return mutate((current) => {
        current[key] = value;
      });
    },

    removeItem(key: string): Promise<void> {
      return mutate((current) => {
        delete current[key];
      });
    },
  };
}

export type EncryptedAuthStorage = ReturnType<typeof createEncryptedAuthStorage>;
