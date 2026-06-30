import { z } from "zod";

export const PasswordCredentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(6).max(128),
});

export type PasswordCredentials = z.infer<typeof PasswordCredentialsSchema>;

export const SignUpCredentialsSchema = PasswordCredentialsSchema.extend({
  name: z.string().trim().min(1).max(100),
});

export const OAuthProviderSchema = z.enum(["google", "github"]);

export const AuthUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  displayName: z.string().min(1),
  avatarUrl: z.url().nullable(),
});

export const AuthSessionSchema = z.object({
  user: AuthUserSchema,
  expiresAt: z.number().int().positive().nullable(),
});

export type AuthUser = z.infer<typeof AuthUserSchema>;
export type AuthSession = z.infer<typeof AuthSessionSchema>;
export type SignUpCredentials = z.infer<typeof SignUpCredentialsSchema>;
export type OAuthProvider = z.infer<typeof OAuthProviderSchema>;

export const SignUpResultSchema = z.object({
  session: AuthSessionSchema.nullable(),
  emailConfirmationRequired: z.boolean(),
});

export const RuntimeInfoSchema = z.object({
  platform: z.enum(["aix", "darwin", "freebsd", "linux", "openbsd", "sunos", "win32", "android"]),
  version: z.string().min(1),
  apiBaseUrl: z.url(),
  authConfigured: z.boolean(),
});

export type SignUpResult = z.infer<typeof SignUpResultSchema>;
export type RuntimeInfo = z.infer<typeof RuntimeInfoSchema>;

export const IPC_CHANNELS = {
  runtimeInfo: "app:get-runtime-info",
  authSession: "auth:get-session",
  authAccessToken: "auth:get-access-token",
  authPassword: "auth:password",
  authSignUp: "auth:sign-up",
  authOAuth: "auth:oauth",
  authSignOut: "auth:sign-out",
} as const;

export type SprintOpsBridge = {
  app: {
    getRuntimeInfo: () => Promise<RuntimeInfo>;
  };
  auth: {
    getSession: () => Promise<AuthSession | null>;
    getAccessToken: () => Promise<string | null>;
    signInWithPassword: (credentials: PasswordCredentials) => Promise<AuthSession>;
    signUp: (credentials: SignUpCredentials) => Promise<SignUpResult>;
    signInWithOAuth: (provider: OAuthProvider) => Promise<AuthSession>;
    signOut: () => Promise<void>;
  };
};

export const WorkspaceTypeSchema = z.enum(["personal", "organization"]);
export const WorkspaceRoleSchema = z.enum(["owner", "admin", "member"]);
export const MembershipStatusSchema = z.enum(["active", "suspended"]);

export const WorkspaceSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(80),
  type: WorkspaceTypeSchema,
  role: WorkspaceRoleSchema,
  createdAt: z.iso.datetime(),
});

export const WorkspaceMemberSchema = z.object({
  userId: z.uuid(),
  email: z.email(),
  displayName: z.string().min(1).max(100),
  role: WorkspaceRoleSchema,
  status: MembershipStatusSchema,
  joinedAt: z.iso.datetime(),
});

export const WorkspaceInvitationSchema = z.object({
  id: z.uuid(),
  workspaceId: z.uuid(),
  email: z.email(),
  role: WorkspaceRoleSchema.exclude(["owner"]),
  status: z.enum(["pending", "accepted", "revoked", "expired"]),
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
});

export const ProjectSchema = z.object({
  id: z.uuid(),
  workspaceId: z.uuid(),
  name: z.string().min(1).max(120),
  key: z.string().regex(/^[A-Z][A-Z0-9]{1,9}$/),
  description: z.string().max(500).nullable(),
  createdAt: z.iso.datetime(),
});

export const WorkspaceBootstrapSchema = z.object({
  workspaces: z.array(WorkspaceSchema),
  selectedWorkspaceId: z.uuid(),
});

export const CreateOrganizationInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
});
export const CreateInvitationInputSchema = z.object({
  email: z.email(),
  role: WorkspaceRoleSchema.exclude(["owner"]),
});
export const InvitationLinkSchema = z.object({
  invitation: WorkspaceInvitationSchema,
  url: z.url(),
});
export const AcceptInvitationInputSchema = z.object({ token: z.string().min(32).max(256) });
export const UpdateMemberRoleInputSchema = z.object({ role: WorkspaceRoleSchema });
export const CreateProjectInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  key: z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9]{1,9}$/),
  description: z.string().trim().max(500).nullable().default(null),
});

export type WorkspaceType = z.infer<typeof WorkspaceTypeSchema>;
export type WorkspaceRole = z.infer<typeof WorkspaceRoleSchema>;
export type Workspace = z.infer<typeof WorkspaceSchema>;
export type WorkspaceMember = z.infer<typeof WorkspaceMemberSchema>;
export type WorkspaceInvitation = z.infer<typeof WorkspaceInvitationSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type WorkspaceBootstrap = z.infer<typeof WorkspaceBootstrapSchema>;
export type CreateOrganizationInput = z.infer<typeof CreateOrganizationInputSchema>;
export type CreateInvitationInput = z.infer<typeof CreateInvitationInputSchema>;
export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;
