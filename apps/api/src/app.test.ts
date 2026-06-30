import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createWorkspaceService } from "@sprintops/domain";
import { createMemoryWorkspaceRepository, fixedTokenIssuer } from "@sprintops/domain/testing";

import { ApiAuthenticationError, authenticateAuthorization, createApiApp, createWorkspaceApi } from "./app.js";

const actor = { id: "00000000-0000-4000-8000-000000000001", email: "owner@example.com", displayName: "Owner" };

describe("workspace API", () => {
  let api: ReturnType<typeof createWorkspaceApi>;

  beforeEach(async () => {
    const service = createWorkspaceService({ repository: createMemoryWorkspaceRepository(), tokenIssuer: fixedTokenIssuer });
    api = createWorkspaceApi(service, "https://app.sprintops.example");
  });

  it("rejects a missing bearer session", async () => {
    await expect(authenticateAuthorization(undefined, { verify: async () => actor })).rejects.toEqual(
      new ApiAuthenticationError("session_required", "Sign in to continue."),
    );
  });

  it("rejects an invalid bearer session", async () => {
    await expect(authenticateAuthorization("Bearer invalid", { verify: async () => null })).rejects.toEqual(
      new ApiAuthenticationError("session_invalid", "Your session is invalid or expired."),
    );
  });

  it("provisions a personal workspace and manages an organization project", async () => {
    const bootstrap = await api.bootstrap(actor);
    expect(bootstrap.workspaces).toHaveLength(1);
    const organization = await api.createOrganization(actor, { name: "Platform Team" });
    const project = await api.createProject(actor, organization.id, { name: "SprintOps", key: "OPS", description: null });
    expect(project).toMatchObject({ key: "OPS", workspaceId: organization.id });
  });

  it("returns a copyable invitation link without persisting the raw token in the response object", async () => {
    const organization = await api.createOrganization(actor, { name: "Delivery Team" });
    const response = await api.createInvitation(actor, organization.id, { email: "member@example.com", role: "member" });
    expect(response).toMatchObject({
      invitation: { email: "member@example.com" }, url: `https://app.sprintops.example/accept-invitation?token=${"a".repeat(64)}`,
    });
  });
});

type ExpressLayer = {
  handle: {
    (request: Request, response: Response, next: (error?: unknown) => void): unknown;
    (error: unknown, request: Request, response: Response, next: (error?: unknown) => void): unknown;
  };
  route?: { path: string; methods: Record<string, boolean>; stack: ExpressLayer[] };
};

function routeHandler(app: ReturnType<typeof createApiApp>, method: string, path: string) {
  const layer = (app.router.stack as unknown as ExpressLayer[]).find((candidate) =>
    candidate.route?.path === path && candidate.route.methods[method],
  );
  if (!layer?.route) throw new Error(`Missing ${method.toUpperCase()} ${path}`);
  return layer.route.stack[0]!.handle;
}

function responseFake(actorValue = actor) {
  const response = {
    locals: { actor: actorValue, correlationId: "test-correlation-id" },
    status: vi.fn(),
    json: vi.fn(),
    type: vi.fn(),
    send: vi.fn(),
  };
  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);
  response.type.mockReturnValue(response);
  response.send.mockReturnValue(response);
  return response;
}

describe("Express workspace routes", () => {
  function appWithService() {
    return createApiApp({
      workspaceService: createWorkspaceService({ repository: createMemoryWorkspaceRepository(), tokenIssuer: fixedTokenIssuer }),
      authVerifier: { verify: async () => actor },
      invitationBaseUrl: "https://app.sprintops.example",
    });
  }

  it("serves a safe invitation handoff page without reflecting the raw token", async () => {
    const app = appWithService();
    const response = responseFake();
    await routeHandler(app, "get", "/accept-invitation")(
      { query: { token: "raw-secret-invitation-token" } } as unknown as Request,
      response as unknown as Response,
      vi.fn(),
    );

    expect(response.type).toHaveBeenCalledWith("html");
    expect(response.status).toHaveBeenCalledWith(200);
    const html = String(response.send.mock.calls[0]?.[0]);
    expect(html).toContain("Copy this invitation link");
    expect(html).toContain("SprintOps");
    expect(html).not.toContain("raw-secret-invitation-token");
  });

  it("returns the documented success envelope and status from the wired organization route", async () => {
    const app = appWithService();
    const response = responseFake();
    await routeHandler(app, "post", "/v1/workspaces")(
      { body: { name: "Platform Team" } } as Request,
      response as unknown as Response,
      vi.fn(),
    );

    expect(response.status).toHaveBeenCalledWith(201);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      ok: true,
      data: expect.objectContaining({ name: "Platform Team", type: "organization" }),
      correlationId: "test-correlation-id",
    }));
  });

  it("maps PostgreSQL unique violations to a stable conflict envelope", async () => {
    const app = appWithService();
    const errorLayer = (app.router.stack as unknown as ExpressLayer[]).find((layer) => layer.handle.length === 4);
    if (!errorLayer) throw new Error("Missing Express error handler");
    const response = responseFake();
    errorLayer.handle(
      Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505" }),
      {} as Request,
      response as unknown as Response,
      vi.fn(),
    );

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith({
      ok: false,
      error: { code: "conflict", message: "A record with those details already exists." },
      correlationId: "test-correlation-id",
    });
  });
});
