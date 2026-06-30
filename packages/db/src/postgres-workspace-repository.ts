import { and, asc, count, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type { CreateProjectInput, Project, WorkspaceMember, WorkspaceRole } from "@sprintops/contracts";
import { WorkspaceDomainError, type StoredInvitation, type WorkspaceRepository } from "@sprintops/domain";

import * as schema from "./schema.js";

type Database = NodePgDatabase<typeof schema>;

function iso(value: Date): string { return value.toISOString(); }

export function createPostgresWorkspaceRepository(database: Database): WorkspaceRepository {
  return {
    async provisionPersonalWorkspace(actor, now) {
      return database.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${actor.id}, 0))`);
        await tx.insert(schema.profiles).values({ userId: actor.id, email: actor.email, displayName: actor.displayName, updatedAt: now })
          .onConflictDoUpdate({ target: schema.profiles.userId, set: { email: actor.email, displayName: actor.displayName, updatedAt: now } });
        const [existing] = await tx.select().from(schema.workspaces)
          .where(and(eq(schema.workspaces.type, "personal"), eq(schema.workspaces.personalOwnerId, actor.id))).limit(1);
        if (existing) return { ...existing, createdAt: iso(existing.createdAt), role: "owner" as const };

        const [workspace] = await tx.insert(schema.workspaces).values({
          name: `${actor.displayName}'s workspace`, slug: `personal-${actor.id}`, type: "personal",
          personalOwnerId: actor.id, createdBy: actor.id, createdAt: now, updatedAt: now,
        }).returning();
        if (!workspace) throw new Error("Personal workspace creation returned no record.");
        await tx.insert(schema.workspaceMemberships).values({ workspaceId: workspace.id, userId: actor.id, role: "owner", joinedAt: now, updatedAt: now });
        await tx.insert(schema.auditRecords).values({ workspaceId: workspace.id, actorId: actor.id, action: "workspace.created", targetType: "workspace", targetId: workspace.id, createdAt: now });
        return { ...workspace, createdAt: iso(workspace.createdAt), role: "owner" as const };
      });
    },

    async listWorkspaces(userId) {
      const rows = await database.select({ workspace: schema.workspaces, role: schema.workspaceMemberships.role })
        .from(schema.workspaceMemberships).innerJoin(schema.workspaces, eq(schema.workspaces.id, schema.workspaceMemberships.workspaceId))
        .where(and(eq(schema.workspaceMemberships.userId, userId), eq(schema.workspaceMemberships.status, "active")))
        .orderBy(asc(schema.workspaces.type), asc(schema.workspaces.createdAt));
      return rows.map(({ workspace, role }) => ({ ...workspace, createdAt: iso(workspace.createdAt), role }));
    },

    async getMembership(workspaceId, userId) {
      const [row] = await database.select({ role: schema.workspaceMemberships.role, status: schema.workspaceMemberships.status })
        .from(schema.workspaceMemberships).where(and(eq(schema.workspaceMemberships.workspaceId, workspaceId), eq(schema.workspaceMemberships.userId, userId))).limit(1);
      return row ?? null;
    },

    async getWorkspaceType(workspaceId) {
      const [row] = await database.select({ type: schema.workspaces.type }).from(schema.workspaces)
        .where(eq(schema.workspaces.id, workspaceId)).limit(1);
      return row?.type ?? null;
    },

    async createOrganization(actor, name, slug, now) {
      return database.transaction(async (tx) => {
        await tx.insert(schema.profiles).values({ userId: actor.id, email: actor.email, displayName: actor.displayName, updatedAt: now })
          .onConflictDoUpdate({ target: schema.profiles.userId, set: { email: actor.email, displayName: actor.displayName, updatedAt: now } });
        const [workspace] = await tx.insert(schema.workspaces).values({ name, slug: `${slug}-${crypto.randomUUID().slice(0, 8)}`, type: "organization", createdBy: actor.id, createdAt: now, updatedAt: now }).returning();
        if (!workspace) throw new Error("Organization creation returned no record.");
        await tx.insert(schema.workspaceMemberships).values({ workspaceId: workspace.id, userId: actor.id, role: "owner", joinedAt: now, updatedAt: now });
        await tx.insert(schema.auditRecords).values({ workspaceId: workspace.id, actorId: actor.id, action: "workspace.created", targetType: "workspace", targetId: workspace.id, createdAt: now });
        return { ...workspace, createdAt: iso(workspace.createdAt), role: "owner" as const };
      });
    },

    async listMembers(workspaceId) {
      const rows = await database.select({ membership: schema.workspaceMemberships, profile: schema.profiles })
        .from(schema.workspaceMemberships).innerJoin(schema.profiles, eq(schema.profiles.userId, schema.workspaceMemberships.userId))
        .where(eq(schema.workspaceMemberships.workspaceId, workspaceId)).orderBy(asc(schema.workspaceMemberships.joinedAt));
      return rows.map(({ membership, profile }): WorkspaceMember => ({
        userId: membership.userId, email: profile.email, displayName: profile.displayName,
        role: membership.role, status: membership.status, joinedAt: iso(membership.joinedAt),
      }));
    },

    async getMember(workspaceId, userId) {
      const [row] = await database.select({ membership: schema.workspaceMemberships, profile: schema.profiles })
        .from(schema.workspaceMemberships).innerJoin(schema.profiles, eq(schema.profiles.userId, schema.workspaceMemberships.userId))
        .where(and(eq(schema.workspaceMemberships.workspaceId, workspaceId), eq(schema.workspaceMemberships.userId, userId))).limit(1);
      return row ? { userId, email: row.profile.email, displayName: row.profile.displayName, role: row.membership.role, status: row.membership.status, joinedAt: iso(row.membership.joinedAt) } : null;
    },

    async addMember(workspaceId, actor, role, now) {
      await database.insert(schema.profiles).values({ userId: actor.id, email: actor.email, displayName: actor.displayName, updatedAt: now })
        .onConflictDoUpdate({ target: schema.profiles.userId, set: { email: actor.email, displayName: actor.displayName, updatedAt: now } });
      const [membership] = await database.insert(schema.workspaceMemberships).values({ workspaceId, userId: actor.id, role, joinedAt: now, updatedAt: now })
        .onConflictDoUpdate({ target: [schema.workspaceMemberships.workspaceId, schema.workspaceMemberships.userId], set: { role, status: "active", updatedAt: now } }).returning();
      if (!membership) throw new Error("Membership creation returned no record.");
      return { userId: actor.id, email: actor.email, displayName: actor.displayName, role: membership.role, status: membership.status, joinedAt: iso(membership.joinedAt) };
    },

    async countActiveOwners(workspaceId) {
      const [row] = await database.select({ value: count() }).from(schema.workspaceMemberships)
        .where(and(eq(schema.workspaceMemberships.workspaceId, workspaceId), eq(schema.workspaceMemberships.status, "active"), eq(schema.workspaceMemberships.role, "owner")));
      return row?.value ?? 0;
    },

    async updateMemberRole(workspaceId, userId, role, actorId, now) {
      return database.transaction(async (tx) => {
        await tx.execute(sql`select id from workspaces where id = ${workspaceId} for update`);
        const [target] = await tx.select().from(schema.workspaceMemberships)
          .where(and(eq(schema.workspaceMemberships.workspaceId, workspaceId), eq(schema.workspaceMemberships.userId, userId))).limit(1);
        if (!target) throw new Error("Member not found.");
        if (target.status === "active" && target.role === "owner" && role !== "owner") {
          const [owners] = await tx.select({ value: count() }).from(schema.workspaceMemberships)
            .where(and(eq(schema.workspaceMemberships.workspaceId, workspaceId), eq(schema.workspaceMemberships.status, "active"), eq(schema.workspaceMemberships.role, "owner")));
          if ((owners?.value ?? 0) <= 1) {
            throw new WorkspaceDomainError("last_owner_required", "A workspace must retain at least one owner.");
          }
        }
        const [membership] = await tx.update(schema.workspaceMemberships).set({ role, updatedAt: now })
          .where(and(eq(schema.workspaceMemberships.workspaceId, workspaceId), eq(schema.workspaceMemberships.userId, userId))).returning();
        if (!membership) throw new Error("Member not found.");
        const [profile] = await tx.select().from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1);
        if (!profile) throw new Error("Member profile not found.");
        await tx.insert(schema.auditRecords).values({ workspaceId, actorId, action: "membership.role_changed", targetType: "membership", targetId: userId, createdAt: now });
        return { userId, email: profile.email, displayName: profile.displayName, role: membership.role, status: membership.status, joinedAt: iso(membership.joinedAt) };
      });
    },

    async removeMember(workspaceId, userId, actorId, now) {
      await database.transaction(async (tx) => {
        await tx.execute(sql`select id from workspaces where id = ${workspaceId} for update`);
        const [target] = await tx.select().from(schema.workspaceMemberships)
          .where(and(eq(schema.workspaceMemberships.workspaceId, workspaceId), eq(schema.workspaceMemberships.userId, userId))).limit(1);
        if (!target) return;
        if (target.status === "active" && target.role === "owner") {
          const [owners] = await tx.select({ value: count() }).from(schema.workspaceMemberships)
            .where(and(eq(schema.workspaceMemberships.workspaceId, workspaceId), eq(schema.workspaceMemberships.status, "active"), eq(schema.workspaceMemberships.role, "owner")));
          if ((owners?.value ?? 0) <= 1) {
            throw new WorkspaceDomainError("last_owner_required", "A workspace must retain at least one owner.");
          }
        }
        await tx.delete(schema.workspaceMemberships)
          .where(and(eq(schema.workspaceMemberships.workspaceId, workspaceId), eq(schema.workspaceMemberships.userId, userId)));
        await tx.insert(schema.auditRecords).values({ workspaceId, actorId, action: "membership.removed", targetType: "membership", targetId: userId, createdAt: now });
      });
    },

    async createInvitation(input) {
      return database.transaction(async (tx) => {
        const [row] = await tx.insert(schema.workspaceInvitations).values({
          workspaceId: input.workspaceId, email: input.email, role: input.role, tokenHash: input.tokenHash,
          invitedBy: input.invitedBy, expiresAt: input.expiresAt, createdAt: input.now,
        }).returning();
        if (!row) throw new Error("Invitation creation returned no record.");
        await tx.insert(schema.auditRecords).values({ workspaceId: input.workspaceId, actorId: input.invitedBy, action: "invitation.created", targetType: "invitation", targetId: row.id, createdAt: input.now });
        return { id: row.id, workspaceId: row.workspaceId, email: row.email, role: row.role as Exclude<WorkspaceRole, "owner">, status: row.status, expiresAt: iso(row.expiresAt), createdAt: iso(row.createdAt) };
      });
    },

    async findInvitationByTokenHash(tokenHash) {
      const [row] = await database.select().from(schema.workspaceInvitations).where(eq(schema.workspaceInvitations.tokenHash, tokenHash)).limit(1);
      return row ? {
        id: row.id, workspaceId: row.workspaceId, email: row.email, role: row.role as Exclude<WorkspaceRole, "owner">,
        status: row.status, expiresAt: iso(row.expiresAt), createdAt: iso(row.createdAt), tokenHash: row.tokenHash,
      } satisfies StoredInvitation : null;
    },

    async expireInvitation(invitationId, actorId, now) {
      await database.transaction(async (tx) => {
        const [invitation] = await tx.update(schema.workspaceInvitations).set({ status: "expired" })
          .where(and(eq(schema.workspaceInvitations.id, invitationId), eq(schema.workspaceInvitations.status, "pending"))).returning();
        if (invitation) {
          await tx.insert(schema.auditRecords).values({ workspaceId: invitation.workspaceId, actorId, action: "invitation.expired", targetType: "invitation", targetId: invitationId, createdAt: now });
        }
      });
    },

    async acceptInvitation(invitationId, actor, now) {
      return database.transaction(async (tx) => {
        const locked = await tx.execute(sql`select * from workspace_invitations where id = ${invitationId} and status = 'pending' for update`);
        const invitation = locked.rows[0] as { workspace_id?: string; role?: WorkspaceRole } | undefined;
        if (!invitation?.workspace_id || !invitation.role) throw new Error("Invitation is not pending.");
        await tx.insert(schema.profiles).values({ userId: actor.id, email: actor.email, displayName: actor.displayName, updatedAt: now })
          .onConflictDoUpdate({ target: schema.profiles.userId, set: { email: actor.email, displayName: actor.displayName, updatedAt: now } });
        const [membership] = await tx.insert(schema.workspaceMemberships).values({ workspaceId: invitation.workspace_id, userId: actor.id, role: invitation.role, joinedAt: now, updatedAt: now })
          .onConflictDoUpdate({ target: [schema.workspaceMemberships.workspaceId, schema.workspaceMemberships.userId], set: { role: invitation.role, status: "active", updatedAt: now } }).returning();
        await tx.update(schema.workspaceInvitations).set({ status: "accepted", acceptedBy: actor.id, acceptedAt: now }).where(eq(schema.workspaceInvitations.id, invitationId));
        if (!membership) throw new Error("Membership creation returned no record.");
        await tx.insert(schema.auditRecords).values({ workspaceId: invitation.workspace_id, actorId: actor.id, action: "invitation.accepted", targetType: "invitation", targetId: invitationId, createdAt: now });
        return { userId: actor.id, email: actor.email, displayName: actor.displayName, role: membership.role, status: membership.status, joinedAt: iso(membership.joinedAt) };
      });
    },

    async listProjects(workspaceId) {
      const rows = await database.select().from(schema.projects).where(eq(schema.projects.workspaceId, workspaceId)).orderBy(asc(schema.projects.createdAt));
      return rows.map((row): Project => ({ id: row.id, workspaceId: row.workspaceId, name: row.name, key: row.key, description: row.description, createdAt: iso(row.createdAt) }));
    },

    async createProject(workspaceId, actorId, input: CreateProjectInput, now) {
      return database.transaction(async (tx) => {
        const [row] = await tx.insert(schema.projects).values({ workspaceId, createdBy: actorId, ...input, createdAt: now, updatedAt: now }).returning();
        if (!row) throw new Error("Project creation returned no record.");
        await tx.insert(schema.auditRecords).values({ workspaceId, actorId, action: "project.created", targetType: "project", targetId: row.id, createdAt: now });
        return { id: row.id, workspaceId: row.workspaceId, name: row.name, key: row.key, description: row.description, createdAt: iso(row.createdAt) };
      });
    },
  };
}
