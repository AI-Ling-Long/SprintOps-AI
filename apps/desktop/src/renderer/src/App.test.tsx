import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { SprintOpsBridge } from "@sprintops/contracts";

import { App } from "./App";
import type { ProjectApi } from "./features/projects";
import type { WorkspaceApi } from "./features/workspaces/workspace-api";

const personalWorkspace = {
  id: "a4609c0a-f126-4a64-a2db-197bb425a45d", name: "Dev's workspace", slug: "dev", type: "personal" as const,
  role: "owner" as const, createdAt: "2026-06-29T00:00:00.000Z",
};

function renderApp(bridge: SprintOpsBridge) {
  const workspaceApi: WorkspaceApi = {
    bootstrap: vi.fn().mockResolvedValue({ workspaces: [personalWorkspace], selectedWorkspaceId: personalWorkspace.id }),
    createOrganization: vi.fn(), listMembers: vi.fn(), createInvitation: vi.fn(), acceptInvitation: vi.fn(),
    updateMemberRole: vi.fn(), removeMember: vi.fn(),
  };
  const projectApi: ProjectApi = { listProjects: vi.fn().mockResolvedValue([]), createProject: vi.fn() };
  return render(<App bridge={bridge} workspaceApi={workspaceApi} projectApi={projectApi} />);
}

function createBridge(session: Awaited<ReturnType<SprintOpsBridge["auth"]["getSession"]>> = {
  user: {
    id: "0ec58a71-9291-4b1a-a9b1-ea495998006e",
    email: "dev@example.com",
    displayName: "Dev User",
    avatarUrl: null,
  },
  expiresAt: 1_800_000_000,
}): SprintOpsBridge {
  return {
    app: {
      getRuntimeInfo: vi.fn().mockResolvedValue({
        platform: "darwin",
        version: "0.1.0",
        apiBaseUrl: "https://api.sprintops.example",
        authConfigured: true,
      }),
    },
    auth: {
      getSession: vi.fn().mockResolvedValue(session),
      getAccessToken: vi.fn().mockResolvedValue("access-token"),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
    },
  };
}

describe("SprintOps application", () => {
  it("restores a valid persisted session into the application shell", async () => {
    renderApp(createBridge());

    expect(screen.getByText("Restoring your SprintOps session…")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Welcome back, Dev User" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "SprintOps" })).toBeInTheDocument();
  });

  it("signs in through the typed desktop bridge", async () => {
    const user = userEvent.setup();
    const bridge = createBridge(null);
    vi.mocked(bridge.auth.signInWithPassword).mockResolvedValue({
      user: {
        id: "0ec58a71-9291-4b1a-a9b1-ea495998006e",
        email: "dev@example.com",
        displayName: "Dev User",
        avatarUrl: null,
      },
      expiresAt: 1_800_000_000,
    });
    renderApp(bridge);

    await user.type(await screen.findByLabelText("Email"), "dev@example.com");
    await user.type(screen.getByLabelText("Password"), "secure-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(bridge.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "dev@example.com",
      password: "secure-password",
    });
    expect(await screen.findByRole("heading", { name: "Welcome back, Dev User" })).toBeInTheDocument();
  });

  it("signs out through the typed desktop bridge", async () => {
    const user = userEvent.setup();
    const bridge = createBridge();
    renderApp(bridge);

    await user.click(await screen.findByRole("button", { name: "Sign out" }));

    expect(bridge.auth.signOut).toHaveBeenCalledOnce();
    expect(await screen.findByRole("heading", { name: "Sign in to SprintOps" })).toBeInTheDocument();
  });

  it("retries session restoration after a transient startup failure", async () => {
    const user = userEvent.setup();
    const bridge = createBridge();
    vi.mocked(bridge.auth.getSession)
      .mockRejectedValueOnce(new Error("Session storage was temporarily unavailable."))
      .mockResolvedValueOnce(null);
    renderApp(bridge);

    await user.click(await screen.findByRole("button", { name: "Try again" }));

    expect(bridge.auth.getSession).toHaveBeenCalledTimes(2);
    expect(await screen.findByRole("heading", { name: "Sign in to SprintOps" })).toBeInTheDocument();
  });
});
