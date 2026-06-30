import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { createApiClient } from "./api-client";

describe("hosted API client", () => {
  it("authenticates requests with the current Supabase access token", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: { status: "ready" },
          correlationId: "server-correlation-id",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const client = createApiClient({
      baseUrl: "https://api.sprintops.example",
      getAccessToken: async () => "access-token",
      fetchImplementation,
      createCorrelationId: () => "client-correlation-id",
    });

    const result = await client.request("/v1/status", {
      schema: z.object({ status: z.literal("ready") }),
    });

    expect(result).toEqual({ status: "ready" });
    expect(fetchImplementation).toHaveBeenCalledWith(
      "https://api.sprintops.example/v1/status",
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer access-token",
          "x-correlation-id": "client-correlation-id",
        }),
      }),
    );
  });

  it("creates correlation IDs through the bound browser crypto object", async () => {
    const randomUUID = vi.spyOn(globalThis.crypto, "randomUUID").mockImplementation(function (this: Crypto) {
      if (this !== globalThis.crypto) throw new TypeError("Illegal invocation");
      return "00000000-0000-4000-8000-000000000001";
    });
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      ok: true, data: { status: "ready" }, correlationId: "server-id",
    }), { status: 200 }));
    const client = createApiClient({
      baseUrl: "https://api.sprintops.example",
      getAccessToken: async () => "access-token",
      fetchImplementation,
    });

    await client.request("/v1/status", { schema: z.object({ status: z.literal("ready") }) });

    expect(randomUUID).toHaveBeenCalledOnce();
    expect(fetchImplementation).toHaveBeenCalledWith(
      "https://api.sprintops.example/v1/status",
      expect.objectContaining({ headers: expect.objectContaining({ "x-correlation-id": "00000000-0000-4000-8000-000000000001" }) }),
    );
  });
});
