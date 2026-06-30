import { describe, expect, it } from "vitest";

import { createWorkspaceService, WorkspaceDomainError } from "./workspace-service.js";
import { createMemoryWorkspaceRepository, fixedTokenIssuer } from "./testing.js";

const owner = { id: "00000000-0000-4000-8000-000000000001", email: "owner@example.com", displayName: "Owner" };
const member = { id: "00000000-0000-4000-8000-000000000002", email: "member@example.com", displayName: "Member" };
const outsider = { id: "00000000-0000-4000-8000-000000000003", email: "outside@example.com", displayName: "Outside" };
const now = new Date("2026-06-29T12:00:00.000Z");

function setup() {
  const repository = createMemoryWorkspaceRepository();
  const service = createWorkspaceService({ repository, tokenIssuer: fixedTokenIssuer, now: () => now });
  return { repository, service };
}

describe("workspace service", () => {
  it("provisions exactly one personal workspace and denies another user", async () => {
    const { service } = setup();
    const first = await service.bootstrap(owner);
    const second = await service.bootstrap(owner);
    await service.bootstrap(outsider);

    expect(first.workspaces).toHaveLength(1);
    expect(second.workspaces).toEqual(first.workspaces);
    await expect(service.listProjects(outsider, first.selectedWorkspaceId)).rejects.toMatchObject({ code: "workspace_forbidden" });
  });

  it("keeps personal workspace membership fixed", async () => {
    const { service } = setup();
    const personal = await service.bootstrap(owner);

    await expect(service.createInvitation(owner, personal.selectedWorkspaceId, { email: member.email, role: "member" }))
      .rejects.toMatchObject({ code: "personal_workspace_membership_fixed" });
    await expect(service.updateMemberRole(owner, personal.selectedWorkspaceId, owner.id, "admin"))
      .rejects.toMatchObject({ code: "personal_workspace_membership_fixed" });
    await expect(service.removeMember(owner, personal.selectedWorkspaceId, owner.id))
      .rejects.toMatchObject({ code: "personal_workspace_membership_fixed" });
  });

  it("creates an organization and a single-use email-bound invitation", async () => {
    const { service } = setup();
    await service.bootstrap(owner);
    const workspace = await service.createOrganization(owner, { name: "Platform Team" });
    const created = await service.createInvitation(owner, workspace.id, { email: member.email, role: "member" });

    expect(created.token).toBe("a".repeat(64));
    await expect(service.acceptInvitation(outsider, created.token)).rejects.toMatchObject({ code: "invitation_email_mismatch" });
    await service.acceptInvitation(member, created.token);
    await expect(service.acceptInvitation(member, created.token)).rejects.toBeInstanceOf(WorkspaceDomainError);
    expect((await service.listMembers(owner, workspace.id)).map((item) => item.email)).toEqual([owner.email, member.email]);
  });

  it("rejects expired invitations", async () => {
    const repository = createMemoryWorkspaceRepository();
    let currentTime = now;
    const service = createWorkspaceService({ repository, tokenIssuer: fixedTokenIssuer, now: () => currentTime });
    const workspace = await service.createOrganization(owner, { name: "Platform Team" });
    const created = await service.createInvitation(owner, workspace.id, { email: member.email, role: "member" });

    currentTime = new Date("2026-07-06T12:00:00.001Z");

    await expect(service.acceptInvitation(member, created.token)).rejects.toMatchObject({ code: "invitation_expired" });
    await expect(service.acceptInvitation(member, created.token)).rejects.toMatchObject({ code: "invitation_invalid" });
  });

  it("accepts an invitation idempotently when the invitee is already a member", async () => {
    const { repository, service } = setup();
    const workspace = await service.createOrganization(owner, { name: "Platform Team" });
    await repository.addMember(workspace.id, member, "member", now);
    const created = await service.createInvitation(owner, workspace.id, { email: member.email, role: "admin" });

    await expect(service.acceptInvitation(member, created.token)).resolves.toMatchObject({ userId: member.id, role: "admin" });
  });

  it("enforces role management and preserves an owner", async () => {
    const { repository, service } = setup();
    const workspace = await service.createOrganization(owner, { name: "Delivery Team" });
    await repository.addMember(workspace.id, member, "member", now);

    await expect(service.updateMemberRole(member, workspace.id, owner.id, "member")).rejects.toMatchObject({ code: "workspace_forbidden" });
    await expect(service.removeMember(owner, workspace.id, owner.id)).rejects.toMatchObject({ code: "last_owner_required" });
    await service.updateMemberRole(owner, workspace.id, member.id, "admin");
    expect((await service.listMembers(owner, workspace.id)).find((item) => item.userId === member.id)?.role).toBe("admin");
  });

  it("lets admins manage members but reserves ownership changes for owners", async () => {
    const { repository, service } = setup();
    const workspace = await service.createOrganization(owner, { name: "Delivery Team" });
    await repository.addMember(workspace.id, member, "admin", now);
    await repository.addMember(workspace.id, outsider, "member", now);

    await expect(service.updateMemberRole(member, workspace.id, outsider.id, "admin")).resolves.toMatchObject({ role: "admin" });
    await expect(service.updateMemberRole(member, workspace.id, outsider.id, "owner")).rejects.toMatchObject({ code: "workspace_forbidden" });
    await expect(service.removeMember(member, workspace.id, owner.id)).rejects.toMatchObject({ code: "workspace_forbidden" });
    await expect(service.removeMember(owner, workspace.id, outsider.id)).resolves.toBeUndefined();
  });

  it("preserves an owner when two ownership changes race", async () => {
    const { repository, service } = setup();
    const workspace = await service.createOrganization(owner, { name: "Delivery Team" });
    await repository.addMember(workspace.id, member, "owner", now);

    const results = await Promise.allSettled([
      service.updateMemberRole(owner, workspace.id, owner.id, "member"),
      service.updateMemberRole(member, workspace.id, member.id, "member"),
    ]);

    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect((await service.listMembers(owner, workspace.id)).filter((item) => item.role === "owner")).toHaveLength(1);
  });

  it("denies member administration and project creation", async () => {
    const { repository, service } = setup();
    const workspace = await service.createOrganization(owner, { name: "Delivery Team" });
    await repository.addMember(workspace.id, member, "member", now);

    await expect(service.createInvitation(member, workspace.id, { email: outsider.email, role: "member" })).rejects.toMatchObject({ code: "workspace_forbidden" });
    await expect(service.updateMemberRole(member, workspace.id, owner.id, "member")).rejects.toMatchObject({ code: "workspace_forbidden" });
    await expect(service.removeMember(member, workspace.id, owner.id)).rejects.toMatchObject({ code: "workspace_forbidden" });
    await expect(service.createProject(member, workspace.id, { name: "Intrusion", key: "BAD", description: null })).rejects.toMatchObject({ code: "workspace_forbidden" });
  });

  it("creates projects only inside an authorized workspace", async () => {
    const { service } = setup();
    const workspace = await service.createOrganization(owner, { name: "Product Team" });
    const project = await service.createProject(owner, workspace.id, { name: "SprintOps", key: "OPS", description: null });

    expect((await service.listProjects(owner, workspace.id))).toEqual([project]);
    await expect(service.createProject(outsider, workspace.id, { name: "Intrusion", key: "BAD", description: null })).rejects.toMatchObject({ code: "workspace_forbidden" });
  });
});
