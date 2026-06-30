import { useCallback, useEffect, useMemo, useState } from "react";

import type { AuthSession, RuntimeInfo, Workspace } from "@sprintops/contracts";

import { ProjectsPage, type ProjectApi } from "../../features/projects";
import { WorkspacePage } from "../../features/workspaces/WorkspacePage";
import { WorkspaceSwitcher } from "../../features/workspaces/WorkspaceSwitcher";
import type { WorkspaceApi } from "../../features/workspaces/workspace-api";

const navigation = ["Dashboard", "Workspaces", "Projects", "Backlog", "Sprint", "Repositories", "Intelligence", "Settings"] as const;
type NavigationItem = (typeof navigation)[number];

type AppShellProps = {
  session: AuthSession;
  runtimeInfo: RuntimeInfo;
  workspaceApi: WorkspaceApi;
  projectApi: ProjectApi;
  onSignOut: () => Promise<void>;
};

function Initials({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return <span aria-hidden="true">{initials || "D"}</span>;
}

export function AppShell({ session, runtimeInfo, workspaceApi, projectApi, onSignOut }: AppShellProps) {
  const [activeItem, setActiveItem] = useState<NavigationItem>("Dashboard");
  const [signingOut, setSigningOut] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [workspaceState, setWorkspaceState] = useState<"loading" | "ready" | "error">("loading");

  const loadWorkspaces = useCallback(async (signal?: AbortSignal) => {
    setWorkspaceState("loading");
    try {
      const bootstrap = await workspaceApi.bootstrap(signal);
      setWorkspaces(bootstrap.workspaces);
      setSelectedWorkspaceId((current) => bootstrap.workspaces.some((workspace) => workspace.id === current)
        ? current
        : bootstrap.selectedWorkspaceId);
      setWorkspaceState("ready");
    } catch {
      if (!signal?.aborted) setWorkspaceState("error");
    }
  }, [workspaceApi]);

  useEffect(() => {
    const controller = new AbortController();
    void workspaceApi.bootstrap(controller.signal).then((bootstrap) => {
      setWorkspaces(bootstrap.workspaces);
      setSelectedWorkspaceId(bootstrap.selectedWorkspaceId);
      setWorkspaceState("ready");
    }).catch(() => {
      if (!controller.signal.aborted) setWorkspaceState("error");
    });
    return () => controller.abort();
  }, [workspaceApi]);

  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? null,
    [selectedWorkspaceId, workspaces],
  );
  const handleWorkspaceContextChange = useCallback((nextWorkspaces: Workspace[], nextSelectedWorkspaceId: string) => {
    setWorkspaces(nextWorkspaces);
    setSelectedWorkspaceId(nextSelectedWorkspaceId);
  }, []);

  const signOut = async () => {
    setSigningOut(true);
    try {
      await onSignOut();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark" aria-hidden="true">S</div>
          <div><strong>SprintOps</strong><span>Desktop copilot</span></div>
        </div>

        <nav aria-label="SprintOps" className="sidebar-nav">
          {navigation.map((item) => (
            <button
              type="button"
              key={item}
              className={activeItem === item ? "nav-item nav-item-active" : "nav-item"}
              onClick={() => setActiveItem(item)}
              aria-current={activeItem === item ? "page" : undefined}
            >
              {item}
            </button>
          ))}
        </nav>

        <div className="sidebar-user">
          <div className="avatar"><Initials name={session.user.displayName} /></div>
          <div className="sidebar-user-copy"><strong>{session.user.displayName}</strong><span>{session.user.email}</span></div>
          <button type="button" className="text-button" onClick={signOut} disabled={signingOut}>
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-context">
            <span className="context-label">{selectedWorkspace?.name ?? "Workspace unavailable"}</span>
            <strong>{activeItem}</strong>
          </div>
          {activeItem !== "Workspaces" && workspaceState === "ready" && selectedWorkspace ? (
            <WorkspaceSwitcher
              workspaces={workspaces}
              selectedWorkspaceId={selectedWorkspace.id}
              onSelect={setSelectedWorkspaceId}
            />
          ) : null}
          <span className="runtime-status">Desktop v{runtimeInfo.version}</span>
        </header>

        <div className="page-content">
          {workspaceState === "loading" ? <p role="status">Loading workspace context…</p> : null}
          {workspaceState === "error" ? (
            <section className="workspace-error" role="alert">
              <p>SprintOps could not load your workspaces. Confirm the Phase 2 API and database are running.</p>
              <button type="button" className="secondary-button" onClick={() => void loadWorkspaces()}>Try again</button>
            </section>
          ) : null}
          {workspaceState === "ready" && activeItem === "Dashboard" ? (
            <>
              <section className="page-heading">
                <div><h1>Welcome back, {session.user.displayName}</h1><p>Plan and deliver work in {selectedWorkspace?.name}.</p></div>
              </section>
              <section className="foundation-grid" aria-label="Foundation status">
                <article className="status-card"><span className="status-dot status-dot-success" /><div><strong>{workspaces.length} workspace{workspaces.length === 1 ? "" : "s"}</strong><p>Personal and organization access is scoped to your membership.</p></div></article>
                <article className="status-card"><span className="status-dot status-dot-success" /><div><strong>Authorization enforced</strong><p>Every request validates your Supabase session and workspace role.</p></div></article>
                <article className="status-card"><span className="status-dot status-dot-info" /><div><strong>Projects ready</strong><p>Create projects inside the selected workspace.</p></div></article>
              </section>
            </>
          ) : null}
          {workspaceState === "ready" && activeItem === "Workspaces" ? (
            <WorkspacePage
              api={workspaceApi}
              currentUserId={session.user.id}
              initialSelectedWorkspaceId={selectedWorkspaceId}
              onContextChange={handleWorkspaceContextChange}
            />
          ) : null}
          {workspaceState === "ready" && activeItem === "Projects" && selectedWorkspace ? (
            <ProjectsPage api={projectApi} workspace={selectedWorkspace} />
          ) : null}
          {workspaceState === "ready" && !["Dashboard", "Workspaces", "Projects"].includes(activeItem) ? (
            <section className="empty-page">
              <span>{activeItem}</span>
              <h1>{activeItem} is ready for its domain slice</h1>
              <p>The secure application shell is in place. This screen will be implemented in its planned phase.</p>
            </section>
          ) : null}
        </div>
      </main>
    </div>
  );
}
