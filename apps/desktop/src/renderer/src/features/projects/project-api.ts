import {
  ProjectSchema,
  type CreateProjectInput,
  type Project,
} from "@sprintops/contracts";

import type { ApiClient } from "../../../services/api-client";

export interface ProjectApi {
  listProjects(workspaceId: string, signal?: AbortSignal): Promise<Project[]>;
  createProject(workspaceId: string, input: CreateProjectInput): Promise<Project>;
}

export function createProjectApi(client: ApiClient): ProjectApi {
  return {
    listProjects(workspaceId, signal) {
      return client.request(`/v1/workspaces/${encodeURIComponent(workspaceId)}/projects`, {
        schema: ProjectSchema.array(),
        signal,
      });
    },

    createProject(workspaceId, input) {
      return client.request(`/v1/workspaces/${encodeURIComponent(workspaceId)}/projects`, {
        schema: ProjectSchema,
        method: "POST",
        body: input,
      });
    },
  };
}

