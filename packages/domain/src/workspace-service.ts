import {
  CreateInvitationInputSchema,
  CreateOrganizationInputSchema,
  CreateProjectInputSchema,
  type CreateInvitationInput,
  type CreateOrganizationInput,
  type CreateProjectInput,
  type Project,
  type Workspace,
  type WorkspaceInvitation,
  type WorkspaceMember,
  type WorkspaceRole,
} from "@sprintops/contracts";

export type Actor = { id: string; email: string; displayName: string };
export type Membership = { role: WorkspaceRole; status: "active" | "suspended" };
export type StoredInvitation = WorkspaceInvitation & { tokenHash: string };

export type WorkspaceRepository = {
  provisionPersonalWorkspace(actor: Actor, now: Date): Promise<Workspace>;
  listWorkspaces(userId: string): Promise<Workspace[]>;
  getMembership(workspaceId: string, userId: string): Promise<Membership | null>;
  getWorkspaceType(workspaceId: string): Promise<"personal" | "organization" | null>;
  createOrganization(actor: Actor, name: string, slug: string, now: Date): Promise<Workspace>;
  listMembers(workspaceId: string): Promise<WorkspaceMember[]>;
  getMember(workspaceId: string, userId: string): Promise<WorkspaceMember | null>;
  addMember(workspaceId: string, actor: Actor, role: WorkspaceRole, now: Date): Promise<WorkspaceMember>;
  countActiveOwners(workspaceId: string): Promise<number>;
  updateMemberRole(workspaceId: string, userId: string, role: WorkspaceRole, actorId: string, now: Date): Promise<WorkspaceMember>;
  removeMember(workspaceId: string, userId: string, actorId: string, now: Date): Promise<void>;
  createInvitation(input: {
    workspaceId: string;
    email: string;
    role: Exclude<WorkspaceRole, "owner">;
    tokenHash: string;
    invitedBy: string;
    expiresAt: Date;
    now: Date;
  }): Promise<WorkspaceInvitation>;
  findInvitationByTokenHash(tokenHash: string): Promise<StoredInvitation | null>;
  expireInvitation(invitationId: string, actorId: string, now: Date): Promise<void>;
  acceptInvitation(invitationId: string, actor: Actor, now: Date): Promise<WorkspaceMember>;
  listProjects(workspaceId: string): Promise<Project[]>;
  createProject(workspaceId: string, actorId: string, input: CreateProjectInput, now: Date): Promise<Project>;
};

export type TokenIssuer = {
  issue(): { token: string; hash: string };
  issueHash(token: string): string;
};

export class WorkspaceDomainError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "WorkspaceDomainError";
  }
}

function slugify(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64);
}

export function createWorkspaceService(dependencies: {
  repository: WorkspaceRepository;
  tokenIssuer: TokenIssuer;
  now?: () => Date;
}) {
  const { repository, tokenIssuer, now = () => new Date() } = dependencies;

  async function requireMembership(actor: Actor, workspaceId: string): Promise<Membership> {
    const membership = await repository.getMembership(workspaceId, actor.id);
    if (!membership || membership.status !== "active") {
      throw new WorkspaceDomainError("workspace_forbidden", "You do not have access to this workspace.");
    }
    return membership;
  }

  async function requireManager(actor: Actor, workspaceId: string): Promise<Membership> {
    const membership = await requireMembership(actor, workspaceId);
    if (membership.role === "member") {
      throw new WorkspaceDomainError("workspace_forbidden", "Workspace administration permission is required.");
    }
    return membership;
  }

  async function requireOrganization(workspaceId: string): Promise<void> {
    if (await repository.getWorkspaceType(workspaceId) !== "organization") {
      throw new WorkspaceDomainError("personal_workspace_membership_fixed", "Personal workspace membership cannot be changed.");
    }
  }

  return {
    async bootstrap(actor: Actor) {
      const personal = await repository.provisionPersonalWorkspace(actor, now());
      const workspaces = await repository.listWorkspaces(actor.id);
      return { workspaces, selectedWorkspaceId: personal.id };
    },

    async createOrganization(actor: Actor, rawInput: CreateOrganizationInput) {
      const input = CreateOrganizationInputSchema.parse(rawInput);
      return repository.createOrganization(actor, input.name, slugify(input.name), now());
    },

    async listMembers(actor: Actor, workspaceId: string) {
      await requireMembership(actor, workspaceId);
      return repository.listMembers(workspaceId);
    },

    async createInvitation(actor: Actor, workspaceId: string, rawInput: CreateInvitationInput) {
      await requireManager(actor, workspaceId);
      await requireOrganization(workspaceId);
      const input = CreateInvitationInputSchema.parse(rawInput);
      const issued = tokenIssuer.issue();
      const invitation = await repository.createInvitation({
        workspaceId,
        email: input.email.toLowerCase(),
        role: input.role,
        tokenHash: issued.hash,
        invitedBy: actor.id,
        expiresAt: new Date(now().getTime() + 7 * 24 * 60 * 60 * 1000),
        now: now(),
      });
      return { invitation, token: issued.token };
    },

    async acceptInvitation(actor: Actor, token: string) {
      const hash = tokenIssuer.issueHash(token);
      const invitation = await repository.findInvitationByTokenHash(hash);
      if (!invitation || invitation.status !== "pending") {
        throw new WorkspaceDomainError("invitation_invalid", "This invitation is invalid or has already been used.");
      }
      if (new Date(invitation.expiresAt).getTime() <= now().getTime()) {
        await repository.expireInvitation(invitation.id, actor.id, now());
        throw new WorkspaceDomainError("invitation_expired", "This invitation has expired.");
      }
      if (invitation.email.toLowerCase() !== actor.email.toLowerCase()) {
        throw new WorkspaceDomainError("invitation_email_mismatch", "Sign in with the email address that was invited.");
      }
      return repository.acceptInvitation(invitation.id, actor, now());
    },

    async updateMemberRole(actor: Actor, workspaceId: string, userId: string, role: WorkspaceRole) {
      const manager = await requireManager(actor, workspaceId);
      await requireOrganization(workspaceId);
      const target = await repository.getMember(workspaceId, userId);
      if (!target) throw new WorkspaceDomainError("member_not_found", "Workspace member was not found.");
      if ((target.role === "owner" || role === "owner") && manager.role !== "owner") {
        throw new WorkspaceDomainError("workspace_forbidden", "Only an owner can change ownership.");
      }
      if (target.role === "owner" && role !== "owner" && (await repository.countActiveOwners(workspaceId)) <= 1) {
        throw new WorkspaceDomainError("last_owner_required", "A workspace must retain at least one owner.");
      }
      return repository.updateMemberRole(workspaceId, userId, role, actor.id, now());
    },

    async removeMember(actor: Actor, workspaceId: string, userId: string) {
      const manager = await requireManager(actor, workspaceId);
      await requireOrganization(workspaceId);
      const target = await repository.getMember(workspaceId, userId);
      if (!target) throw new WorkspaceDomainError("member_not_found", "Workspace member was not found.");
      if (target.role === "owner" && manager.role !== "owner") {
        throw new WorkspaceDomainError("workspace_forbidden", "Only an owner can remove an owner.");
      }
      if (target.role === "owner" && (await repository.countActiveOwners(workspaceId)) <= 1) {
        throw new WorkspaceDomainError("last_owner_required", "A workspace must retain at least one owner.");
      }
      await repository.removeMember(workspaceId, userId, actor.id, now());
    },

    async listProjects(actor: Actor, workspaceId: string) {
      await requireMembership(actor, workspaceId);
      return repository.listProjects(workspaceId);
    },

    async createProject(actor: Actor, workspaceId: string, rawInput: CreateProjectInput) {
      await requireManager(actor, workspaceId);
      const input = CreateProjectInputSchema.parse(rawInput);
      return repository.createProject(workspaceId, actor.id, input, now());
    },
  };
}

export type WorkspaceService = ReturnType<typeof createWorkspaceService>;
