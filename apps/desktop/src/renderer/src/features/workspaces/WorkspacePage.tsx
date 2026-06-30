import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Workspace, WorkspaceMember, WorkspaceRole } from "@sprintops/contracts";

import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import type { WorkspaceApi } from "./workspace-api";

type WorkspacePageProps = {
  api: WorkspaceApi;
  currentUserId: string;
  invitationToken?: string | null;
  initialSelectedWorkspaceId?: string;
  onContextChange?: (workspaces: Workspace[], selectedWorkspaceId: string) => void;
};

type LoadState = "loading" | "ready" | "error";

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : "SprintOps could not complete the request.";
}

function expiryLabel(value: string): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

function invitationTokenFrom(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try { return new URL(trimmed).searchParams.get("token"); } catch { return trimmed; }
}

export function WorkspacePage({
  api, currentUserId, invitationToken = null, initialSelectedWorkspaceId, onContextChange,
}: WorkspacePageProps) {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [membersState, setMembersState] = useState<LoadState>("ready");
  const [membersError, setMembersError] = useState<string | null>(null);
  const [memberReload, setMemberReload] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState("");
  const [creatingOrganization, setCreatingOrganization] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [invitation, setInvitation] = useState<{ url: string; expiresAt: string } | null>(null);
  const [creatingInvitation, setCreatingInvitation] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [pendingMemberIds, setPendingMemberIds] = useState<Set<string>>(() => new Set());
  const [acceptState, setAcceptState] = useState<"idle" | "pending" | "accepted" | "error">("idle");
  const [invitationValue, setInvitationValue] = useState(invitationToken ?? "");
  const initialSelectedWorkspaceIdRef = useRef(initialSelectedWorkspaceId);

  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? null,
    [selectedWorkspaceId, workspaces],
  );
  const canManage = selectedWorkspace?.type === "organization" && (selectedWorkspace.role === "owner" || selectedWorkspace.role === "admin");

  const loadBootstrap = useCallback(async (signal?: AbortSignal) => {
    setLoadState("loading");
    setError(null);
    try {
      const bootstrap = await api.bootstrap(signal);
      setWorkspaces(bootstrap.workspaces);
      const selected = bootstrap.workspaces.some((item) => item.id === selectedWorkspaceId)
        ? selectedWorkspaceId
        : bootstrap.workspaces.some((item) => item.id === initialSelectedWorkspaceIdRef.current)
          ? initialSelectedWorkspaceIdRef.current as string
          : bootstrap.selectedWorkspaceId;
      setSelectedWorkspaceId(selected);
      onContextChange?.(bootstrap.workspaces, selected);
      setLoadState("ready");
    } catch (loadError) {
      if (!signal?.aborted) {
        setError(messageFrom(loadError));
        setLoadState("error");
      }
    }
  }, [api, onContextChange, selectedWorkspaceId]);

  useEffect(() => {
    const controller = new AbortController();
    api.bootstrap(controller.signal).then((bootstrap) => {
      setWorkspaces(bootstrap.workspaces);
      const selectedId = bootstrap.workspaces.some((item) => item.id === initialSelectedWorkspaceIdRef.current)
        ? initialSelectedWorkspaceIdRef.current as string
        : bootstrap.selectedWorkspaceId;
      setSelectedWorkspaceId(selectedId);
      onContextChange?.(bootstrap.workspaces, selectedId);
      const selected = bootstrap.workspaces.find((item) => item.id === selectedId);
      if (selected?.type === "organization") setMembersState("loading");
      setLoadState("ready");
    }).catch((loadError: unknown) => {
      if (!controller.signal.aborted) {
        setError(messageFrom(loadError));
        setLoadState("error");
      }
    });
    return () => controller.abort();
  }, [api, onContextChange]);

  useEffect(() => {
    if (selectedWorkspace?.type !== "organization") {
      return;
    }
    const controller = new AbortController();
    api.listMembers(selectedWorkspace.id, controller.signal).then((result) => {
      setMembers(result);
      setMembersError(null);
      setMembersState("ready");
    }).catch((loadError: unknown) => {
      if (!controller.signal.aborted) {
        setMembersError(messageFrom(loadError));
        setMembersState("error");
      }
    });
    return () => controller.abort();
  }, [api, selectedWorkspace, memberReload]);

  async function createOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingOrganization(true);
    setError(null);
    try {
      const workspace = await api.createOrganization({ name: organizationName });
      setWorkspaces((current) => {
        const next = [...current, workspace];
        onContextChange?.(next, workspace.id);
        return next;
      });
      setInvitation(null);
      setCopyStatus(null);
      setMembersError(null);
      setMembersState("loading");
      setSelectedWorkspaceId(workspace.id);
      setOrganizationName("");
    } catch (createError) {
      setError(messageFrom(createError));
    } finally {
      setCreatingOrganization(false);
    }
  }

  async function createInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedWorkspace) return;
    setCreatingInvitation(true);
    setInvitation(null);
    setCopyStatus(null);
    setError(null);
    try {
      const result = await api.createInvitation(selectedWorkspace.id, { email: inviteEmail, role: inviteRole });
      setInvitation({ url: result.url, expiresAt: result.invitation.expiresAt });
      setInviteEmail("");
    } catch (inviteError) {
      setError(messageFrom(inviteError));
    } finally {
      setCreatingInvitation(false);
    }
  }

  async function copyInvitation() {
    if (!invitation) return;
    try {
      await navigator.clipboard.writeText(invitation.url);
      setCopyStatus("Invitation link copied.");
    } catch {
      setCopyStatus("Copy failed. Select and copy the link manually.");
    }
  }

  async function changeRole(member: WorkspaceMember, role: WorkspaceRole) {
    if (!selectedWorkspace) return;
    setPendingMemberIds((current) => new Set(current).add(member.userId));
    setError(null);
    try {
      const updated = await api.updateMemberRole(selectedWorkspace.id, member.userId, role);
      setMembers((current) => current.map((item) => item.userId === updated.userId ? updated : item));
    } catch (updateError) {
      setError(messageFrom(updateError));
    } finally {
      setPendingMemberIds((current) => {
        const next = new Set(current); next.delete(member.userId); return next;
      });
    }
  }

  async function removeMember(member: WorkspaceMember) {
    if (!selectedWorkspace || !window.confirm(`Remove ${member.email} from this workspace?`)) return;
    setPendingMemberIds((current) => new Set(current).add(member.userId));
    setError(null);
    try {
      await api.removeMember(selectedWorkspace.id, member.userId);
      setMembers((current) => current.filter((item) => item.userId !== member.userId));
    } catch (removeError) {
      setError(messageFrom(removeError));
    } finally {
      setPendingMemberIds((current) => {
        const next = new Set(current); next.delete(member.userId); return next;
      });
    }
  }

  async function acceptInvitation() {
    const token = invitationTokenFrom(invitationValue);
    if (!token) return;
    setAcceptState("pending");
    setError(null);
    try {
      await api.acceptInvitation(token);
      setAcceptState("accepted");
      await loadBootstrap();
    } catch (acceptError) {
      setError(messageFrom(acceptError));
      setAcceptState("error");
    }
  }

  if (loadState === "loading" && workspaces.length === 0) return <p role="status">Loading workspaces…</p>;
  if (loadState === "error" && workspaces.length === 0) {
    return <section className="workspace-error" role="alert"><p>{error}</p><button type="button" onClick={() => void loadBootstrap()}>Try again</button></section>;
  }

  return (
    <section className="workspace-page" aria-labelledby="workspace-heading">
      <header className="workspace-page-header">
        <div><p className="eyebrow">Workspaces</p><h1 id="workspace-heading">Workspace settings</h1></div>
        <WorkspaceSwitcher workspaces={workspaces} selectedWorkspaceId={selectedWorkspaceId} onSelect={(workspaceId) => {
          const next = workspaces.find((workspace) => workspace.id === workspaceId);
          setInvitation(null);
          setCopyStatus(null);
          setMembersError(null);
          setError(null);
          setMembers([]);
          setMembersState(next?.type === "organization" ? "loading" : "ready");
          setSelectedWorkspaceId(workspaceId);
          onContextChange?.(workspaces, workspaceId);
        }} />
      </header>

      {error && <p className="inline-error" role="alert">{error}</p>}

      {acceptState !== "accepted" && (
        <aside className="invitation-acceptance" aria-labelledby="accept-invitation-heading">
          <h2 id="accept-invitation-heading">Workspace invitation</h2>
          <p>Paste a copyable invitation link to add its organization to your workspace list.</p>
          <label><span>Paste an invitation link</span><input aria-label="Paste invitation link" value={invitationValue} onChange={(event) => setInvitationValue(event.target.value)} /></label>
          <button type="button" disabled={acceptState === "pending" || !invitationTokenFrom(invitationValue)} onClick={() => void acceptInvitation()}>
            {acceptState === "pending" ? "Accepting…" : "Accept invitation"}
          </button>
        </aside>
      )}
      {acceptState === "accepted" && <p className="success-message" role="status">Invitation accepted.</p>}

      <section className="workspace-create" aria-labelledby="create-organization-heading">
        <h2 id="create-organization-heading">Create an organization</h2>
        <form onSubmit={(event) => void createOrganization(event)}>
          <label><span>Organization name</span><input required minLength={2} maxLength={100} value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} /></label>
          <button type="submit" disabled={creatingOrganization}>{creatingOrganization ? "Creating…" : "Create organization"}</button>
        </form>
      </section>

      {selectedWorkspace?.type === "personal" && (
        <section className="workspace-empty-state"><h2>{selectedWorkspace.name}</h2><p>This personal workspace is private to your account. Create or select an organization to invite teammates.</p></section>
      )}

      {selectedWorkspace?.type === "organization" && (
        <section className="organization-members" aria-labelledby="members-heading">
          <header><h2 id="members-heading">{selectedWorkspace.name} members</h2><p>Your role: {selectedWorkspace.role}</p></header>
          {!canManage && <p className="permission-notice">Only workspace owners and admins can invite or manage members.</p>}

          {canManage && (
            <form className="invitation-form" onSubmit={(event) => void createInvitation(event)}>
              <label><span>Invitee email</span><input type="email" required value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} /></label>
              <label><span>Invitation role</span><select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as "admin" | "member")}><option value="member">Member</option><option value="admin">Admin</option></select></label>
              <button type="submit" disabled={creatingInvitation}>{creatingInvitation ? "Creating link…" : "Create invitation link"}</button>
            </form>
          )}

          {invitation && (
            <div className="invitation-result" role="status">
              <label><span>Invitation link</span><input aria-label="Invitation link" readOnly value={invitation.url} /></label>
              <p>Expires {expiryLabel(invitation.expiresAt)}.</p>
              <button type="button" onClick={() => void copyInvitation()}>Copy invitation link</button>
              {copyStatus && <p>{copyStatus}</p>}
            </div>
          )}

          {membersState === "loading" && <p role="status">Loading members…</p>}
          {membersState === "error" && <div className="members-error" role="alert"><p>{membersError ?? "Members are temporarily unavailable."}</p><button type="button" onClick={() => { setMembersError(null); setMembersState("loading"); setMemberReload((value) => value + 1); }}>Retry members</button></div>}
          {membersState === "ready" && members.length === 0 && <p>No active members were found.</p>}
          {membersState === "ready" && members.length > 0 && (
            <ul className="member-list">
              {members.map((member) => {
                const pending = pendingMemberIds.has(member.userId);
                const ownerCount = members.filter((item) => item.status === "active" && item.role === "owner").length;
                const protectedOwner = member.role === "owner" && (selectedWorkspace.role === "admin" || ownerCount === 1);
                const availableRoles: WorkspaceRole[] = selectedWorkspace.role === "owner" || member.role === "owner" ? ["member", "admin", "owner"] : ["member", "admin"];
                return (
                  <li key={member.userId} className="member-row">
                    <div><strong>{member.displayName}</strong><span>{member.email}</span><small>{member.status}</small></div>
                    <label><span className="visually-hidden">Role for {member.email}</span><select aria-label={`Role for ${member.email}`} value={member.role} disabled={!canManage || pending || protectedOwner} onChange={(event) => void changeRole(member, event.target.value as WorkspaceRole)}>{availableRoles.map((role) => <option key={role} value={role}>{role[0].toUpperCase() + role.slice(1)}</option>)}</select></label>
                    {canManage && member.userId !== currentUserId && !protectedOwner && <button type="button" disabled={pending} onClick={() => void removeMember(member)}>{pending ? "Updating…" : "Remove"}</button>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </section>
  );
}
