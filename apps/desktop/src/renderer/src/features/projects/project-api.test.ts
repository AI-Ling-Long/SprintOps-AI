import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../../../services/api-client";

import { createProjectApi } from "./project-api";

const project = {
  id: "66cf684f-5747-45ac-8827-a73d5f585d94",
  workspaceId: "2049f790-0c84-4675-814c-a4381d787908",
  name: "SprintOps Desktop",
  key: "DESK",
  description: null,
  createdAt: "2026-06-29T12:00:00.000Z",
};

describe("project API adapter", () => {
  it("uses encoded workspace project paths and validates list responses", async () => {
    const request = vi.fn().mockImplementation(async (_path: string, options: { schema: { parse(value: unknown): unknown } }) => (
      options.schema.parse([project])
    ));
    const api = createProjectApi({ request } as unknown as ApiClient);
    const signal = new AbortController().signal;

    await expect(api.listProjects("workspace/with spaces", signal)).resolves.toEqual([project]);
    expect(request).toHaveBeenCalledWith("/v1/workspaces/workspace%2Fwith%20spaces/projects", {
      schema: expect.any(Object),
      signal,
    });
  });

  it("posts the project input and validates the created project", async () => {
    const request = vi.fn().mockImplementation(async (_path: string, options: { schema: { parse(value: unknown): unknown } }) => (
      options.schema.parse(project)
    ));
    const api = createProjectApi({ request } as unknown as ApiClient);
    const input = { name: "SprintOps Desktop", key: "DESK", description: null };

    await expect(api.createProject(project.workspaceId, input)).resolves.toEqual(project);
    expect(request).toHaveBeenCalledWith(`/v1/workspaces/${project.workspaceId}/projects`, {
      schema: expect.any(Object),
      method: "POST",
      body: input,
    });
  });
});
