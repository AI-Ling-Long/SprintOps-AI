import {
  InvitationLinkSchema,
  WorkspaceBootstrapSchema,
  WorkspaceMemberSchema,
  WorkspaceSchema,
  type CreateInvitationInput,
  type CreateOrganizationInput,
  type Workspace,
  type WorkspaceBootstrap,
  type WorkspaceMember,
  type WorkspaceRole,
} from "@sprintops/contracts";
import { z } from "zod";

import type { ApiClient } from "../../../services/api-client";

export type WorkspaceApi = {
  bootstrap(signal?: AbortSignal): Promise<WorkspaceBootstrap>;
  createOrganization(input: CreateOrganizationInput): Promise<Workspace>;
  listMembers(workspaceId: string, signal?: AbortSignal): Promise<WorkspaceMember[]>;
  createInvitation(workspaceId: string, input: CreateInvitationInput): Promise<z.infer<typeof InvitationLinkSchema>>;
  acceptInvitation(token: string): Promise<WorkspaceMember>;
  updateMemberRole(workspaceId: string, userId: string, role: WorkspaceRole): Promise<WorkspaceMember>;
  removeMember(workspaceId: string, userId: string): Promise<void>;
};

const RemovedSchema = z.object({ removed: z.literal(true) });

export function createWorkspaceApiClient(client: ApiClient): WorkspaceApi {
  return {
    bootstrap: (signal) => client.request("/v1/bootstrap", { schema: WorkspaceBootstrapSchema, method: "GET", signal }),
    createOrganization: (input) => client.request("/v1/workspaces", { schema: WorkspaceSchema, method: "POST", body: input }),
    listMembers: (workspaceId, signal) => client.request(`/v1/workspaces/${workspaceId}/members`, {
      schema: z.array(WorkspaceMemberSchema), method: "GET", signal,
    }),
    createInvitation: (workspaceId, input) => client.request(`/v1/workspaces/${workspaceId}/invitations`, {
      schema: InvitationLinkSchema, method: "POST", body: input,
    }),
    acceptInvitation: (token) => client.request("/v1/invitations/accept", {
      schema: WorkspaceMemberSchema, method: "POST", body: { token },
    }),
    updateMemberRole: (workspaceId, userId, role) => client.request(`/v1/workspaces/${workspaceId}/members/${userId}`, {
      schema: WorkspaceMemberSchema, method: "PATCH", body: { role },
    }),
    async removeMember(workspaceId, userId) {
      await client.request(`/v1/workspaces/${workspaceId}/members/${userId}`, { schema: RemovedSchema, method: "DELETE" });
    },
  };
}
