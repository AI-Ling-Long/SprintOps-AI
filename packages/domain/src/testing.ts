import { randomUUID } from "node:crypto";

import type { CreateProjectInput, Project, Workspace, WorkspaceMember, WorkspaceRole } from "@sprintops/contracts";

import { WorkspaceDomainError } from "./workspace-service.js";
import type { Actor, Membership, StoredInvitation, TokenIssuer, WorkspaceRepository } from "./workspace-service.js";

const fixedToken = "a".repeat(64);
export const fixedTokenIssuer: TokenIssuer = {
  issue: () => ({ token: fixedToken, hash: `hash:${fixedToken}` }),
  issueHash: (token: string) => `hash:${token}`,
};

export function createMemoryWorkspaceRepository(): WorkspaceRepository {
  const workspaces = new Map<string, Omit<Workspace, "role">>();
  const members = new Map<string, Map<string, WorkspaceMember>>();
  const invitations = new Map<string, StoredInvitation>();
  const projects = new Map<string, Project[]>();

  const addMember = async (workspaceId: string, actor: Actor, role: WorkspaceRole, now: Date) => {
    const member: WorkspaceMember = {
      userId: actor.id,
      email: actor.email,
      displayName: actor.displayName,
      role,
      status: "active",
      joinedAt: now.toISOString(),
    };
    const workspaceMembers = members.get(workspaceId) ?? new Map<string, WorkspaceMember>();
    workspaceMembers.set(actor.id, member);
    members.set(workspaceId, workspaceMembers);
    return member;
  };

  const workspaceForUser = (workspaceId: string, userId: string): Workspace | null => {
    const workspace = workspaces.get(workspaceId);
    const membership = members.get(workspaceId)?.get(userId);
    return workspace && membership ? { ...workspace, role: membership.role } : null;
  };

  return {
    async provisionPersonalWorkspace(actor, now) {
      for (const workspace of workspaces.values()) {
        if (workspace.type === "personal" && members.get(workspace.id)?.has(actor.id)) {
          return { ...workspace, role: "owner" };
        }
      }
      const id = randomUUID();
      const workspace = { id, name: `${actor.displayName}'s workspace`, slug: `personal-${actor.id}`, type: "personal" as const, createdAt: now.toISOString() };
      workspaces.set(id, workspace);
      await addMember(id, actor, "owner", now);
      return { ...workspace, role: "owner" };
    },
    async listWorkspaces(userId) {
      return [...workspaces.keys()].map((id) => workspaceForUser(id, userId)).filter((item): item is Workspace => Boolean(item));
    },
    async getMembership(workspaceId, userId): Promise<Membership | null> {
      const member = members.get(workspaceId)?.get(userId);
      return member ? { role: member.role, status: member.status } : null;
    },
    async getWorkspaceType(workspaceId) { return workspaces.get(workspaceId)?.type ?? null; },
    async createOrganization(actor, name, slug, now) {
      const id = randomUUID();
      const workspace = { id, name, slug: `${slug}-${id.slice(0, 8)}`, type: "organization" as const, createdAt: now.toISOString() };
      workspaces.set(id, workspace);
      await addMember(id, actor, "owner", now);
      return { ...workspace, role: "owner" };
    },
    async listMembers(workspaceId) {
      return [...(members.get(workspaceId)?.values() ?? [])].sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
    },
    async getMember(workspaceId, userId) { return members.get(workspaceId)?.get(userId) ?? null; },
    addMember,
    async countActiveOwners(workspaceId) {
      return [...(members.get(workspaceId)?.values() ?? [])].filter((member) => member.status === "active" && member.role === "owner").length;
    },
    async updateMemberRole(workspaceId, userId, role) {
      const member = members.get(workspaceId)?.get(userId);
      if (!member) throw new Error("Member not found.");
      if (member.status === "active" && member.role === "owner" && role !== "owner") {
        const activeOwners = [...(members.get(workspaceId)?.values() ?? [])]
          .filter((candidate) => candidate.status === "active" && candidate.role === "owner").length;
        if (activeOwners <= 1) {
          throw new WorkspaceDomainError("last_owner_required", "A workspace must retain at least one owner.");
        }
      }
      const updated = { ...member, role };
      members.get(workspaceId)?.set(userId, updated);
      return updated;
    },
    async removeMember(workspaceId, userId) {
      const member = members.get(workspaceId)?.get(userId);
      if (member?.status === "active" && member.role === "owner") {
        const activeOwners = [...(members.get(workspaceId)?.values() ?? [])]
          .filter((candidate) => candidate.status === "active" && candidate.role === "owner").length;
        if (activeOwners <= 1) {
          throw new WorkspaceDomainError("last_owner_required", "A workspace must retain at least one owner.");
        }
      }
      members.get(workspaceId)?.delete(userId);
    },
    async createInvitation(input) {
      const invitation: StoredInvitation = {
        id: randomUUID(), workspaceId: input.workspaceId, email: input.email, role: input.role,
        status: "pending", expiresAt: input.expiresAt.toISOString(), createdAt: input.now.toISOString(), tokenHash: input.tokenHash,
      };
      invitations.set(invitation.id, invitation);
      return {
        id: invitation.id, workspaceId: invitation.workspaceId, email: invitation.email,
        role: invitation.role, status: invitation.status, expiresAt: invitation.expiresAt, createdAt: invitation.createdAt,
      };
    },
    async findInvitationByTokenHash(tokenHash) {
      return [...invitations.values()].find((invitation) => invitation.tokenHash === tokenHash) ?? null;
    },
    async expireInvitation(invitationId) {
      const invitation = invitations.get(invitationId);
      if (invitation?.status === "pending") invitations.set(invitationId, { ...invitation, status: "expired" });
    },
    async acceptInvitation(invitationId, actor, now) {
      const invitation = invitations.get(invitationId);
      if (!invitation || invitation.status !== "pending") throw new Error("Invitation is not pending.");
      invitations.set(invitationId, { ...invitation, status: "accepted" });
      return addMember(invitation.workspaceId, actor, invitation.role, now);
    },
    async listProjects(workspaceId) { return projects.get(workspaceId) ?? []; },
    async createProject(workspaceId, _actorId, input: CreateProjectInput, now) {
      const project: Project = { id: randomUUID(), workspaceId, ...input, createdAt: now.toISOString() };
      projects.set(workspaceId, [...(projects.get(workspaceId) ?? []), project]);
      return project;
    },
  };
}
