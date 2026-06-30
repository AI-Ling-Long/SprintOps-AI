import { useEffect, useMemo, useState } from "react";

import type { AuthSession, RuntimeInfo, SprintOpsBridge } from "@sprintops/contracts";

import { AuthScreen } from "./components/auth/AuthScreen";
import { LoadingScreen } from "./components/feedback/LoadingScreen";
import { AppShell } from "./components/layout/AppShell";
import { createProjectApi, type ProjectApi } from "./features/projects";
import { createWorkspaceApiClient, type WorkspaceApi } from "./features/workspaces/workspace-api";
import { createApiClient } from "../services/api-client";

type AppProps = {
  bridge: SprintOpsBridge;
  workspaceApi?: WorkspaceApi;
  projectApi?: ProjectApi;
};

type StartupState =
  | { status: "loading" }
  | { status: "ready"; runtimeInfo: RuntimeInfo; session: AuthSession | null }
  | { status: "error"; message: string };

async function loadStartup(bridge: SprintOpsBridge): Promise<StartupState> {
  try {
    const [runtimeInfo, session] = await Promise.all([
      bridge.app.getRuntimeInfo(),
      bridge.auth.getSession(),
    ]);
    return { status: "ready", runtimeInfo, session };
  } catch {
    return { status: "error", message: "SprintOps could not restore the desktop session." };
  }
}

function AuthenticatedShell({
  bridge, session, runtimeInfo, workspaceApi: workspaceApiOverride, projectApi: projectApiOverride, onSignOut,
}: {
  bridge: SprintOpsBridge;
  session: AuthSession;
  runtimeInfo: RuntimeInfo;
  workspaceApi?: WorkspaceApi;
  projectApi?: ProjectApi;
  onSignOut: () => Promise<void>;
}) {
  const apiClient = useMemo(() => createApiClient({
    baseUrl: runtimeInfo.apiBaseUrl,
    getAccessToken: bridge.auth.getAccessToken,
  }), [bridge, runtimeInfo.apiBaseUrl]);
  const workspaceApi = useMemo(() => workspaceApiOverride ?? createWorkspaceApiClient(apiClient), [apiClient, workspaceApiOverride]);
  const projectApi = useMemo(() => projectApiOverride ?? createProjectApi(apiClient), [apiClient, projectApiOverride]);

  return <AppShell session={session} runtimeInfo={runtimeInfo} workspaceApi={workspaceApi} projectApi={projectApi} onSignOut={onSignOut} />;
}

export function App({ bridge, workspaceApi, projectApi }: AppProps) {
  const [startup, setStartup] = useState<StartupState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    void loadStartup(bridge).then((state) => {
      if (active) setStartup(state);
    });
    return () => {
      active = false;
    };
  }, [bridge]);

  const retryStartup = () => {
    setStartup({ status: "loading" });
    void loadStartup(bridge).then(setStartup);
  };

  if (startup.status === "loading") return <LoadingScreen />;

  if (startup.status === "error") {
    return (
      <main className="error-screen">
        <h1>SprintOps could not start</h1>
        <p>{startup.message}</p>
        <button type="button" className="primary-button" onClick={retryStartup}>Try again</button>
      </main>
    );
  }

  if (!startup.session) {
    return (
      <AuthScreen
        auth={bridge.auth}
        authConfigured={startup.runtimeInfo.authConfigured}
        onAuthenticated={(session) => setStartup({ ...startup, session })}
      />
    );
  }

  return (
    <AuthenticatedShell
      bridge={bridge}
      session={startup.session}
      runtimeInfo={startup.runtimeInfo}
      workspaceApi={workspaceApi}
      projectApi={projectApi}
      onSignOut={async () => {
        await bridge.auth.signOut();
        setStartup({ ...startup, session: null });
      }}
    />
  );
}
