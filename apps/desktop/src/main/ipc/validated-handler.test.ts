// @vitest-environment node

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createValidatedHandler } from "./validated-handler";

describe("validated IPC handler", () => {
  it("rejects malformed renderer input before executing privileged behavior", async () => {
    let executed = false;
    const handler = createValidatedHandler(
      z.object({ repositoryPathToken: z.string().min(1) }),
      async () => {
        executed = true;
        return { ok: true };
      },
    );

    await expect(handler({ repositoryPathToken: "" })).rejects.toMatchObject({
      code: "invalid_ipc_payload",
    });
    expect(executed).toBe(false);
  });
});
