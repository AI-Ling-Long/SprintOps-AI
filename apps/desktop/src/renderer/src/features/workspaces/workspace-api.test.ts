import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../../../services/api-client";
import { createWorkspaceApiClient } from "./workspace-api";

describe("workspace API adapter", () => {
  it("maps every workspace operation to its validated authenticated route", async () => {
    const request = vi.fn().mockResolvedValue(undefined);
    const api = createWorkspaceApiClient({ request } as unknown as ApiClient);
    const workspaceId = "a4609c0a-f126-4a64-a2db-197bb425a45d";
    const userId = "b4609c0a-f126-4a64-a2db-197bb425a45d";

    await api.bootstrap();
    await api.createOrganization({ name: "Platform" });
    await api.listMembers(workspaceId);
    await api.createInvitation(workspaceId, { email: "dev@example.com", role: "member" });
    await api.acceptInvitation("x".repeat(32));
    await api.updateMemberRole(workspaceId, userId, "admin");
    await api.removeMember(workspaceId, userId);

    expect(request.mock.calls.map(([path, options]) => [path, options.method, options.body])).toEqual([
      ["/v1/bootstrap", "GET", undefined],
      ["/v1/workspaces", "POST", { name: "Platform" }],
      [`/v1/workspaces/${workspaceId}/members`, "GET", undefined],
      [`/v1/workspaces/${workspaceId}/invitations`, "POST", { email: "dev@example.com", role: "member" }],
      ["/v1/invitations/accept", "POST", { token: "x".repeat(32) }],
      [`/v1/workspaces/${workspaceId}/members/${userId}`, "PATCH", { role: "admin" }],
      [`/v1/workspaces/${workspaceId}/members/${userId}`, "DELETE", undefined],
    ]);
  });
});
