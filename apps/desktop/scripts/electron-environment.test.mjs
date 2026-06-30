import { describe, expect, it } from "vitest";

import { createElectronEnvironment } from "./electron-environment.mjs";

describe("Electron process environment", () => {
  it("removes Node compatibility mode without mutating the parent environment", () => {
    const parent = {
      ELECTRON_RUN_AS_NODE: "1",
      SPRINTOPS_API_BASE_URL: "https://api.sprintops.example",
    };

    const child = createElectronEnvironment(parent);

    expect(child).toEqual({ SPRINTOPS_API_BASE_URL: "https://api.sprintops.example" });
    expect(parent.ELECTRON_RUN_AS_NODE).toBe("1");
  });
});
