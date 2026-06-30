import { describe, expect, it } from "vitest";

import { CreateInvitationInputSchema, CreateProjectInputSchema, WorkspaceBootstrapSchema } from "./index.js";

describe("workspace contracts", () => {
  it("normalizes project keys and rejects owner invitations", () => {
    expect(CreateProjectInputSchema.parse({ name: "SprintOps", key: "ops", description: null }).key).toBe("OPS");
    expect(CreateInvitationInputSchema.safeParse({ email: "dev@example.com", role: "owner" }).success).toBe(false);
  });

  it("requires a selected workspace to exist as a UUID", () => {
    expect(WorkspaceBootstrapSchema.safeParse({ workspaces: [], selectedWorkspaceId: "personal" }).success).toBe(false);
  });
});
