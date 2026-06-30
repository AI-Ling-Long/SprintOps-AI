import { sql } from "drizzle-orm";
import {
  index, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid,
} from "drizzle-orm/pg-core";

export const workspaceType = pgEnum("workspace_type", ["personal", "organization"]);
export const workspaceRole = pgEnum("workspace_role", ["owner", "admin", "member"]);
export const membershipStatus = pgEnum("membership_status", ["active", "suspended"]);
export const invitationStatus = pgEnum("invitation_status", ["pending", "accepted", "revoked", "expired"]);

export const profiles = pgTable("profiles", {
  userId: uuid("user_id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  type: workspaceType("type").notNull(),
  personalOwnerId: uuid("personal_owner_id"),
  createdBy: uuid("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("workspaces_slug_unique").on(table.slug),
  uniqueIndex("workspaces_personal_owner_unique").on(table.personalOwnerId).where(sql`${table.type} = 'personal'`),
]);

export const workspaceMemberships = pgTable("workspace_memberships", {
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull(),
  role: workspaceRole("role").notNull(),
  status: membershipStatus("status").notNull().default("active"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ name: "workspace_memberships_workspace_user_pk", columns: [table.workspaceId, table.userId] }),
  index("workspace_memberships_user_status_idx").on(table.userId, table.status),
]);

export const workspaceInvitations = pgTable("workspace_invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: workspaceRole("role").notNull(),
  tokenHash: text("token_hash").notNull(),
  status: invitationStatus("status").notNull().default("pending"),
  invitedBy: uuid("invited_by").notNull(),
  acceptedBy: uuid("accepted_by"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("workspace_invitations_token_hash_unique").on(table.tokenHash),
  index("workspace_invitations_workspace_status_idx").on(table.workspaceId, table.status),
  index("workspace_invitations_email_status_idx").on(table.email, table.status),
]);

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  key: text("key").notNull(),
  description: text("description"),
  createdBy: uuid("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("projects_workspace_key_unique").on(table.workspaceId, table.key),
  index("projects_workspace_created_idx").on(table.workspaceId, table.createdAt),
]);

export const projectMembers = pgTable("project_members", {
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ name: "project_members_project_user_pk", columns: [table.projectId, table.userId] })]);

export const auditRecords = pgTable("audit_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: uuid("target_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("audit_records_workspace_created_idx").on(table.workspaceId, table.createdAt)]);
