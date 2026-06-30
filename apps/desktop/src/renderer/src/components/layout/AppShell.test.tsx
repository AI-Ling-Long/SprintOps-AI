import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ProjectApi } from "../../features/projects";
import type { WorkspaceApi } from "../../features/workspaces/workspace-api";
import { AppShell } from "./AppShell";

const personal = { id: "a4609c0a-f126-4a64-a2db-197bb425a45d", name: "Ada's workspace", slug: "ada", type: "personal" as const, role: "owner" as const, createdAt: "2026-06-29T00:00:00.000Z" };
const organization = { id: "b4609c0a-f126-4a64-a2db-197bb425a45d", name: "Platform", slug: "platform", type: "organization" as const, role: "owner" as const, createdAt: "2026-06-29T00:00:00.000Z" };

function workspaceApi(): WorkspaceApi {
  return {
    bootstrap: vi.fn().mockResolvedValue({ workspaces: [personal, organization], selectedWorkspaceId: personal.id }),
    createOrganization: vi.fn(), listMembers: vi.fn().mockResolvedValue([]), createInvitation: vi.fn(),
    acceptInvitation: vi.fn(), updateMemberRole: vi.fn(), removeMember: vi.fn(),
  };
}

function projectApi(): ProjectApi {
  return { listProjects: vi.fn().mockResolvedValue([]), createProject: vi.fn() };
}

describe("application workspace shell", () => {
  it("switches workspace context explicitly and scopes the projects page", async () => {
    const user = userEvent.setup();
    const projects = projectApi();
    render(<AppShell
      session={{ user: { id: "c4609c0a-f126-4a64-a2db-197bb425a45d", email: "ada@example.com", displayName: "Ada", avatarUrl: null }, expiresAt: null }}
      runtimeInfo={{ platform: "darwin", version: "0.1.0", apiBaseUrl: "http://127.0.0.1:3000", authConfigured: true }}
      workspaceApi={workspaceApi()}
      projectApi={projects}
      onSignOut={vi.fn()}
    />);

    await user.selectOptions(await screen.findByLabelText("Current workspace"), organization.id);
    await user.click(screen.getByRole("button", { name: "Projects" }));

    expect(await screen.findByRole("heading", { name: "Projects" })).toBeInTheDocument();
    expect(projects.listProjects).toHaveBeenCalledWith(organization.id, expect.any(AbortSignal));
    expect(screen.getByText("Platform", { selector: ".context-label" })).toBeInTheDocument();
  });

  it("opens workspace management from navigation", async () => {
    const user = userEvent.setup();
    render(<AppShell
      session={{ user: { id: "c4609c0a-f126-4a64-a2db-197bb425a45d", email: "ada@example.com", displayName: "Ada", avatarUrl: null }, expiresAt: null }}
      runtimeInfo={{ platform: "darwin", version: "0.1.0", apiBaseUrl: "http://127.0.0.1:3000", authConfigured: true }}
      workspaceApi={workspaceApi()}
      projectApi={projectApi()}
      onSignOut={vi.fn()}
    />);

    await user.click(await screen.findByRole("button", { name: "Workspaces" }));
    expect(await screen.findByRole("heading", { name: "Workspace settings" })).toBeInTheDocument();
  });
});
