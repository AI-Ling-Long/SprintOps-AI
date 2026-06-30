import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Project, Workspace } from "@sprintops/contracts";

import { ProjectsPage, type ProjectApi } from "./ProjectsPage";

const workspace = {
  id: "2049f790-0c84-4675-814c-a4381d787908",
  name: "Platform Team",
  slug: "platform-team",
  type: "organization",
  role: "owner",
  createdAt: "2026-06-29T12:00:00.000Z",
} satisfies Workspace;

const project = {
  id: "66cf684f-5747-45ac-8827-a73d5f585d94",
  workspaceId: workspace.id,
  name: "SprintOps Desktop",
  key: "DESK",
  description: "Desktop client",
  createdAt: "2026-06-29T12:00:00.000Z",
} satisfies Project;

function createApi(projects: Project[] = []): ProjectApi {
  return {
    listProjects: vi.fn().mockResolvedValue(projects),
    createProject: vi.fn().mockResolvedValue(project),
  };
}

describe("ProjectsPage", () => {
  it("lists projects in the selected workspace", async () => {
    const api = createApi([project]);

    render(<ProjectsPage workspace={workspace} api={api} />);

    expect(screen.getByText("Loading projects…")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "SprintOps Desktop" })).toBeInTheDocument();
    expect(screen.getByText("DESK")).toBeInTheDocument();
    expect(api.listProjects).toHaveBeenCalledWith(workspace.id, expect.any(AbortSignal));
  });

  it("creates a project and exposes the pending state", async () => {
    const user = userEvent.setup();
    let finishCreation: ((value: Project) => void) | undefined;
    const api = createApi();
    vi.mocked(api.createProject).mockImplementation(
      () => new Promise((resolve) => { finishCreation = resolve; }),
    );
    render(<ProjectsPage workspace={workspace} api={api} />);
    await screen.findByText("No projects yet");

    await user.type(screen.getByLabelText("Project name"), "SprintOps Desktop");
    await user.type(screen.getByLabelText("Project key"), "desk");
    await user.type(screen.getByLabelText("Description (optional)"), "Desktop client");
    await user.click(screen.getByRole("button", { name: "Create project" }));

    expect(api.createProject).toHaveBeenCalledWith(workspace.id, {
      name: "SprintOps Desktop",
      key: "DESK",
      description: "Desktop client",
    });
    expect(screen.getByRole("button", { name: "Creating project…" })).toBeDisabled();

    finishCreation?.(project);
    expect(await screen.findByRole("heading", { name: "SprintOps Desktop" })).toBeInTheDocument();
  });

  it("reloads projects when the selected workspace changes", async () => {
    const api = createApi([project]);
    const { rerender } = render(<ProjectsPage workspace={workspace} api={api} />);
    await screen.findByRole("heading", { name: "SprintOps Desktop" });
    const secondWorkspace = { ...workspace, id: "ea994720-e39a-419e-af86-354625b098f1", name: "API Team" };
    vi.mocked(api.listProjects).mockResolvedValueOnce([]);

    rerender(<ProjectsPage workspace={secondWorkspace} api={api} />);

    await screen.findByText("No projects yet");
    expect(api.listProjects).toHaveBeenLastCalledWith(secondWorkspace.id, expect.any(AbortSignal));
  });

  it("offers retry after a loading error", async () => {
    const user = userEvent.setup();
    const api = createApi();
    vi.mocked(api.listProjects)
      .mockRejectedValueOnce(new Error("Projects are unavailable."))
      .mockResolvedValueOnce([]);
    render(<ProjectsPage workspace={workspace} api={api} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Projects are unavailable.");
    await user.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(api.listProjects).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("No projects yet")).toBeInTheDocument();
  });

  it("shows members a permission state instead of project creation controls", async () => {
    render(<ProjectsPage workspace={{ ...workspace, role: "member" }} api={createApi()} />);

    await screen.findByText("No projects yet");
    expect(screen.getByText("Only workspace owners and admins can create projects.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create project" })).not.toBeInTheDocument();
  });

  it("keeps project drafts isolated when the selected workspace changes", async () => {
    const user = userEvent.setup();
    const api = createApi();
    const { rerender } = render(<ProjectsPage workspace={workspace} api={api} />);
    await screen.findByText("No projects yet");
    await user.type(screen.getByLabelText("Project name"), "Platform roadmap");
    await user.type(screen.getByLabelText("Project key"), "plat");

    const secondWorkspace = { ...workspace, id: "ea994720-e39a-419e-af86-354625b098f1", name: "API Team" };
    rerender(<ProjectsPage workspace={secondWorkspace} api={api} />);

    expect(screen.getByLabelText("Project name")).toHaveValue("");
    expect(screen.getByLabelText("Project key")).toHaveValue("");
    await user.type(screen.getByLabelText("Project name"), "API gateway");
    await user.type(screen.getByLabelText("Project key"), "api");
    await user.click(screen.getByRole("button", { name: "Create project" }));
    expect(api.createProject).toHaveBeenLastCalledWith(secondWorkspace.id, {
      name: "API gateway",
      key: "API",
      description: null,
    });
  });

  it("tracks pending project creation independently for each workspace", async () => {
    const user = userEvent.setup();
    const api = createApi();
    const completions = new Map<string, (value: Project) => void>();
    vi.mocked(api.createProject).mockImplementation(
      (workspaceId) => new Promise((resolve) => { completions.set(workspaceId, resolve); }),
    );
    const { rerender } = render(<ProjectsPage workspace={workspace} api={api} />);
    await screen.findByText("No projects yet");
    await user.type(screen.getByLabelText("Project name"), "Platform roadmap");
    await user.type(screen.getByLabelText("Project key"), "plat");
    await user.click(screen.getByRole("button", { name: "Create project" }));
    expect(screen.getByRole("button", { name: "Creating project…" })).toBeDisabled();

    const secondWorkspace = { ...workspace, id: "ea994720-e39a-419e-af86-354625b098f1", name: "API Team" };
    rerender(<ProjectsPage workspace={secondWorkspace} api={api} />);
    expect(screen.getByRole("button", { name: "Create project" })).toBeEnabled();
    await user.type(screen.getByLabelText("Project name"), "API gateway");
    await user.type(screen.getByLabelText("Project key"), "api");
    await user.click(screen.getByRole("button", { name: "Create project" }));

    await act(async () => {
      completions.get(secondWorkspace.id)?.({ ...project, workspaceId: secondWorkspace.id });
    });
    rerender(<ProjectsPage workspace={workspace} api={api} />);
    expect(screen.getByRole("button", { name: "Creating project…" })).toBeDisabled();

    await act(async () => {
      completions.get(workspace.id)?.(project);
    });
    expect(screen.getByRole("button", { name: "Create project" })).toBeEnabled();
  });
});
