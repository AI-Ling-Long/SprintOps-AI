import { randomUUID } from "node:crypto";

import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { z } from "zod";

import {
  AcceptInvitationInputSchema, CreateInvitationInputSchema, CreateOrganizationInputSchema,
  CreateProjectInputSchema, UpdateMemberRoleInputSchema,
} from "@sprintops/contracts";
import { WorkspaceDomainError, type Actor, type WorkspaceService } from "@sprintops/domain";

export type AuthVerifier = { verify(token: string): Promise<Actor | null> };

export class ApiAuthenticationError extends Error {
  constructor(readonly code: "session_required" | "session_invalid", message: string) {
    super(message);
    this.name = "ApiAuthenticationError";
  }
}

export async function authenticateAuthorization(authorization: string | undefined, verifier: AuthVerifier): Promise<Actor> {
  if (!authorization?.startsWith("Bearer ")) throw new ApiAuthenticationError("session_required", "Sign in to continue.");
  const actor = await verifier.verify(authorization.slice(7));
  if (!actor) throw new ApiAuthenticationError("session_invalid", "Your session is invalid or expired.");
  return actor;
}

export function createWorkspaceApi(workspaceService: WorkspaceService, invitationBaseUrl: string) {
  return {
    bootstrap: (actor: Actor) => workspaceService.bootstrap(actor),
    createOrganization: (actor: Actor, input: unknown) => workspaceService.createOrganization(actor, CreateOrganizationInputSchema.parse(input)),
    createProject: (actor: Actor, workspaceId: string, input: unknown) => workspaceService.createProject(actor, workspaceId, CreateProjectInputSchema.parse(input)),
    async createInvitation(actor: Actor, workspaceId: string, input: unknown) {
      const created = await workspaceService.createInvitation(actor, workspaceId, CreateInvitationInputSchema.parse(input));
      const url = new URL("/accept-invitation", invitationBaseUrl);
      url.searchParams.set("token", created.token);
      return { invitation: created.invitation, url: url.toString() };
    },
  };
}

const WorkspaceIdParams = z.object({ workspaceId: z.uuid() });
const MemberParams = WorkspaceIdParams.extend({ userId: z.uuid() });

function correlationId(request: Request): string {
  const provided = request.header("x-correlation-id");
  return provided && provided.length <= 100 ? provided : randomUUID();
}

function success(response: Response, data: unknown, status = 200) {
  return response.status(status).json({ ok: true, data, correlationId: response.locals.correlationId as string });
}

function isPostgresUniqueViolation(error: unknown): error is { code: "23505" } {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

const invitationHandoffPage = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Accept SprintOps invitation</title>
  </head>
  <body>
    <main>
      <h1>Accept this invitation in SprintOps</h1>
      <p>Copy this invitation link from your browser address bar, open SprintOps, and paste it into the invitation field.</p>
      <p>You can close this page after returning to SprintOps.</p>
    </main>
  </body>
</html>`;

export function createApiApp(dependencies: {
  workspaceService: WorkspaceService;
  authVerifier: AuthVerifier;
  invitationBaseUrl: string;
  corsOrigin?: string;
}) {
  const workspaceApi = createWorkspaceApi(dependencies.workspaceService, dependencies.invitationBaseUrl);
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({
    origin(origin, callback) {
      const allowed = !origin || origin === "null" || origin === dependencies.corsOrigin;
      callback(null, allowed);
    },
  }));
  app.use(express.json({ limit: "64kb" }));
  app.use((request, response, next) => {
    response.locals.correlationId = correlationId(request);
    next();
  });
  app.get("/accept-invitation", (_request, response) =>
    response.type("html").status(200).send(invitationHandoffPage));
  app.use(async (request, response, next) => {
    const authorization = request.header("authorization");
    try {
      response.locals.actor = await authenticateAuthorization(authorization, dependencies.authVerifier);
      next();
    } catch (error) {
      if (error instanceof ApiAuthenticationError) {
        response.status(401).json({ ok: false, error: { code: error.code, message: error.message }, correlationId: response.locals.correlationId });
        return;
      }
      next(error);
    }
  });

  const actor = (response: Response) => response.locals.actor as Actor;

  app.get("/v1/bootstrap", async (_request, response) => success(response, await workspaceApi.bootstrap(actor(response))));
  app.post("/v1/workspaces", async (request, response) => {
    const input = CreateOrganizationInputSchema.parse(request.body);
    return success(response, await workspaceApi.createOrganization(actor(response), input), 201);
  });
  app.get("/v1/workspaces/:workspaceId/members", async (request, response) => {
    const { workspaceId } = WorkspaceIdParams.parse(request.params);
    return success(response, await dependencies.workspaceService.listMembers(actor(response), workspaceId));
  });
  app.post("/v1/workspaces/:workspaceId/invitations", async (request, response) => {
    const { workspaceId } = WorkspaceIdParams.parse(request.params);
    const input = CreateInvitationInputSchema.parse(request.body);
    return success(response, await workspaceApi.createInvitation(actor(response), workspaceId, input), 201);
  });
  app.post("/v1/invitations/accept", async (request, response) => {
    const { token } = AcceptInvitationInputSchema.parse(request.body);
    return success(response, await dependencies.workspaceService.acceptInvitation(actor(response), token));
  });
  app.patch("/v1/workspaces/:workspaceId/members/:userId", async (request, response) => {
    const { workspaceId, userId } = MemberParams.parse(request.params);
    const { role } = UpdateMemberRoleInputSchema.parse(request.body);
    return success(response, await dependencies.workspaceService.updateMemberRole(actor(response), workspaceId, userId, role));
  });
  app.delete("/v1/workspaces/:workspaceId/members/:userId", async (request, response) => {
    const { workspaceId, userId } = MemberParams.parse(request.params);
    await dependencies.workspaceService.removeMember(actor(response), workspaceId, userId);
    return success(response, { removed: true });
  });
  app.get("/v1/workspaces/:workspaceId/projects", async (request, response) => {
    const { workspaceId } = WorkspaceIdParams.parse(request.params);
    return success(response, await dependencies.workspaceService.listProjects(actor(response), workspaceId));
  });
  app.post("/v1/workspaces/:workspaceId/projects", async (request, response) => {
    const { workspaceId } = WorkspaceIdParams.parse(request.params);
    const input = CreateProjectInputSchema.parse(request.body);
    return success(response, await workspaceApi.createProject(actor(response), workspaceId, input), 201);
  });

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    void _next;
    let status = 500;
    let code = "internal_error";
    let message = "SprintOps could not complete the request.";
    if (error instanceof z.ZodError) {
      status = 400; code = "invalid_request"; message = "The request contains invalid data.";
    } else if (isPostgresUniqueViolation(error)) {
      status = 409; code = "conflict"; message = "A record with those details already exists.";
    } else if (error instanceof WorkspaceDomainError) {
      code = error.code; message = error.message;
      status = error.code.includes("forbidden") ? 403 : error.code.includes("not_found") ? 404 : error.code.includes("invalid") || error.code.includes("expired") || error.code.includes("mismatch") ? 409 : 400;
    }
    response.status(status).json({ ok: false, error: { code, message }, correlationId: response.locals.correlationId ?? randomUUID() });
  });
  return app;
}
