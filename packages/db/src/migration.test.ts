import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("Phase 2 migration", () => {
  it("creates tenant constraints, lookup indexes, and RLS policies", async () => {
    const path = fileURLToPath(new URL("../drizzle/0001_phase_2_workspaces.sql", import.meta.url));
    const migration = await readFile(path, "utf8");

    for (const table of ["profiles", "workspaces", "workspace_memberships", "workspace_invitations", "projects", "project_members", "audit_records"]) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS "${table}"`);
      expect(migration).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
    }
    expect(migration).toContain("workspace_memberships_workspace_user_pk");
    expect(migration).toContain("workspace_invitations_token_hash_unique");
    expect(migration).toContain("is_workspace_member");
    expect(migration).toContain("auth.uid()");
  });

  it("keeps personal workspaces restricted to their sole owner", async () => {
    const path = fileURLToPath(new URL("../drizzle/0002_personal_workspace_membership.sql", import.meta.url));
    const migration = await readFile(path, "utf8");

    expect(migration).toContain("enforce_personal_workspace_membership");
    expect(migration).toContain("personal workspace membership is fixed");
    expect(migration).toContain("reject_personal_workspace_invitation");
    expect(migration).toContain("personal workspaces cannot have invitations");
  });
});
