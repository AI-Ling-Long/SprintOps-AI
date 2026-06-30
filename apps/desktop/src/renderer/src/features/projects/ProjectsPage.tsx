import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import type { CreateProjectInput, Project, Workspace } from "@sprintops/contracts";

import type { ProjectApi } from "./project-api";

export type { ProjectApi } from "./project-api";

type ProjectsPageProps = {
  workspace: Workspace;
  api: ProjectApi;
};

type ProjectListState =
  | { status: "loading"; workspaceId: string }
  | { status: "ready"; workspaceId: string; projects: Project[] }
  | { status: "error"; workspaceId: string; message: string };

type ProjectDraft = {
  name: string;
  key: string;
  description: string;
};

const EMPTY_DRAFT: ProjectDraft = { name: "", key: "", description: "" };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "SprintOps could not load projects.";
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function ProjectsPage({ workspace, api }: ProjectsPageProps) {
  const [listState, setListState] = useState<ProjectListState>({ status: "loading", workspaceId: workspace.id });
  const [drafts, setDrafts] = useState<Record<string, ProjectDraft>>({});
  const [creationFailures, setCreationFailures] = useState<Record<string, string | undefined>>({});
  const [pendingWorkspaceIds, setPendingWorkspaceIds] = useState<Set<string>>(() => new Set());
  const activeWorkspaceId = useRef(workspace.id);

  useEffect(() => {
    activeWorkspaceId.current = workspace.id;
  }, [workspace.id]);

  const loadProjects = useCallback((signal?: AbortSignal) => {
    return api.listProjects(workspace.id, signal).then(
      (projects) => {
        if (activeWorkspaceId.current === workspace.id) {
          setListState({ status: "ready", workspaceId: workspace.id, projects });
        }
      },
      (error: unknown) => {
        if (!isAbortError(error) && activeWorkspaceId.current === workspace.id) {
          setListState({ status: "error", workspaceId: workspace.id, message: errorMessage(error) });
        }
      },
    );
  }, [api, workspace.id]);

  useEffect(() => {
    const controller = new AbortController();
    void loadProjects(controller.signal);
    return () => controller.abort();
  }, [loadProjects]);

  const canCreateProjects = workspace.role === "owner" || workspace.role === "admin";
  const draft = drafts[workspace.id] ?? EMPTY_DRAFT;
  const isCreating = pendingWorkspaceIds.has(workspace.id);
  const creationError = creationFailures[workspace.id] ?? null;
  const visibleListState: ProjectListState = listState.workspaceId === workspace.id
    ? listState
    : { status: "loading", workspaceId: workspace.id };

  function retryLoading() {
    setListState({ status: "loading", workspaceId: workspace.id });
    void loadProjects();
  }

  function updateDraft(field: keyof ProjectDraft, value: string) {
    setDrafts((current) => ({
      ...current,
      [workspace.id]: { ...(current[workspace.id] ?? EMPTY_DRAFT), [field]: value },
    }));
  }

  async function submitProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isCreating) return;

    const requestedWorkspaceId = workspace.id;
    const input: CreateProjectInput = {
      name: draft.name.trim(),
      key: draft.key.trim().toUpperCase(),
      description: draft.description.trim() || null,
    };

    setCreationFailures((current) => ({ ...current, [requestedWorkspaceId]: undefined }));
    setPendingWorkspaceIds((current) => new Set(current).add(requestedWorkspaceId));
    try {
      const project = await api.createProject(requestedWorkspaceId, input);
      setDrafts((current) => ({ ...current, [requestedWorkspaceId]: EMPTY_DRAFT }));
      if (activeWorkspaceId.current === requestedWorkspaceId) {
        setListState((current) => current.status === "ready" && current.workspaceId === requestedWorkspaceId
          ? { status: "ready", workspaceId: requestedWorkspaceId, projects: [...current.projects, project] }
          : current);
      }
    } catch (error) {
      setCreationFailures((current) => ({ ...current, [requestedWorkspaceId]: errorMessage(error) }));
    } finally {
      setPendingWorkspaceIds((current) => {
        const next = new Set(current);
        next.delete(requestedWorkspaceId);
        return next;
      });
    }
  }

  return (
    <section className="projects-page" aria-labelledby="projects-heading">
      <header className="projects-page__header">
        <div>
          <p className="projects-page__eyebrow">{workspace.name}</p>
          <h1 id="projects-heading">Projects</h1>
          <p>Organize sprint work inside this workspace.</p>
        </div>
      </header>

      <div className="projects-page__layout">
        <section className="projects-page__list" aria-labelledby="project-list-heading" aria-busy={visibleListState.status === "loading"}>
          <h2 id="project-list-heading">Workspace projects</h2>

          {visibleListState.status === "loading" && <p role="status">Loading projects…</p>}

          {visibleListState.status === "error" && (
            <div className="projects-page__error" role="alert">
              <p>{visibleListState.message}</p>
              <button type="button" onClick={retryLoading}>Try again</button>
            </div>
          )}

          {visibleListState.status === "ready" && visibleListState.projects.length === 0 && (
            <div className="projects-page__empty">
              <h3>No projects yet</h3>
              <p>Create the first project to start organizing backlog and sprint work.</p>
            </div>
          )}

          {visibleListState.status === "ready" && visibleListState.projects.length > 0 && (
            <ul className="projects-page__cards">
              {visibleListState.projects.map((project) => (
                <li className="projects-page__card" key={project.id}>
                  <span className="projects-page__key">{project.key}</span>
                  <h3>{project.name}</h3>
                  <p>{project.description ?? "No description provided."}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="projects-page__create" aria-labelledby="create-project-heading">
          <h2 id="create-project-heading">Create project</h2>
          {!canCreateProjects ? (
            <p className="projects-page__permission">Only workspace owners and admins can create projects.</p>
          ) : (
            <form onSubmit={(event) => void submitProject(event)} aria-busy={isCreating}>
              <label htmlFor="project-name">Project name</label>
              <input
                id="project-name"
                value={draft.name}
                onChange={(event) => updateDraft("name", event.target.value)}
                minLength={2}
                maxLength={120}
                required
                disabled={isCreating}
              />

              <label htmlFor="project-key">Project key</label>
              <input
                id="project-key"
                value={draft.key}
                onChange={(event) => updateDraft("key", event.target.value.toUpperCase())}
                minLength={2}
                maxLength={10}
                pattern="[A-Z][A-Z0-9]{1,9}"
                title="Use 2–10 uppercase letters or numbers, starting with a letter."
                required
                disabled={isCreating}
              />

              <label htmlFor="project-description">Description (optional)</label>
              <textarea
                id="project-description"
                value={draft.description}
                onChange={(event) => updateDraft("description", event.target.value)}
                maxLength={500}
                rows={4}
                disabled={isCreating}
              />

              {creationError && <p className="projects-page__error" role="alert">{creationError}</p>}

              <button type="submit" disabled={isCreating}>
                {isCreating ? "Creating project…" : "Create project"}
              </button>
            </form>
          )}
        </aside>
      </div>
    </section>
  );
}
