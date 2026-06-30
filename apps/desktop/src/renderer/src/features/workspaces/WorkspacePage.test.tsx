import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceMember } from "@sprintops/contracts";

import { WorkspacePage } from "./WorkspacePage";
import type { WorkspaceApi } from "./workspace-api";

const personal = { id: "a4609c0a-f126-4a64-a2db-197bb425a45d", name: "Ada's workspace", slug: "ada", type: "personal" as const, role: "owner" as const, createdAt: "2026-06-29T00:00:00.000Z" };
const organization = { id: "b4609c0a-f126-4a64-a2db-197bb425a45d", name: "Platform", slug: "platform", type: "organization" as const, role: "owner" as const, createdAt: "2026-06-29T00:00:00.000Z" };
const owner = { userId: "c4609c0a-f126-4a64-a2db-197bb425a45d", email: "ada@example.com", displayName: "Ada", role: "owner" as const, status: "active" as const, joinedAt: "2026-06-29T00:00:00.000Z" };

function makeApi(overrides: Partial<WorkspaceApi> = {}): WorkspaceApi {
  return {
    bootstrap: vi.fn().mockResolvedValue({ workspaces: [personal, organization], selectedWorkspaceId: personal.id }),
    createOrganization: vi.fn().mockResolvedValue(organization),
    listMembers: vi.fn().mockResolvedValue([owner]),
    createInvitation: vi.fn().mockResolvedValue({
      invitation: { id: "d4609c0a-f126-4a64-a2db-197bb425a45d", workspaceId: organization.id, email: "dev@example.com", role: "member", status: "pending", expiresAt: "2026-07-06T00:00:00.000Z", createdAt: "2026-06-29T00:00:00.000Z" },
      url: "https://app.sprintops.test/accept-invitation?token=abcdefghijklmnopqrstuvwxyz123456",
    }),
    acceptInvitation: vi.fn().mockResolvedValue(owner),
    updateMemberRole: vi.fn().mockResolvedValue({ ...owner, role: "admin" }),
    removeMember: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("WorkspacePage", () => {
  afterEach(() => vi.restoreAllMocks());

  it("loads workspaces and fetches organization members when switched", async () => {
    const api = makeApi();
    render(<WorkspacePage api={api} currentUserId={owner.userId} />);

    await userEvent.selectOptions(await screen.findByLabelText("Current workspace"), organization.id);

    expect(await screen.findByText("ada@example.com")).toBeInTheDocument();
    expect(api.listMembers).toHaveBeenCalledWith(organization.id, expect.any(AbortSignal));
  });

  it("creates an organization and selects it", async () => {
    const api = makeApi({ bootstrap: vi.fn().mockResolvedValue({ workspaces: [personal], selectedWorkspaceId: personal.id }) });
    render(<WorkspacePage api={api} currentUserId={owner.userId} />);

    await userEvent.type(await screen.findByLabelText("Organization name"), "Platform");
    await userEvent.click(screen.getByRole("button", { name: "Create organization" }));

    await waitFor(() => expect(screen.getByLabelText("Current workspace")).toHaveValue(organization.id));
    expect(api.createOrganization).toHaveBeenCalledWith({ name: "Platform" });
  });

  it("creates a seven-day copyable invitation and manages member roles", async () => {
    const member = { ...owner, userId: "e4609c0a-f126-4a64-a2db-197bb425a45d", email: "dev@example.com", displayName: "Dev", role: "member" as const };
    const api = makeApi({
      bootstrap: vi.fn().mockResolvedValue({ workspaces: [organization], selectedWorkspaceId: organization.id }),
      listMembers: vi.fn().mockResolvedValue([owner, member]),
      updateMemberRole: vi.fn().mockResolvedValue({ ...member, role: "admin" }),
    });
    render(<WorkspacePage api={api} currentUserId={owner.userId} />);

    await userEvent.type(await screen.findByLabelText("Invitee email"), "dev@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Create invitation link" }));

    expect((await screen.findByRole("textbox", { name: "Invitation link" })).getAttribute("value")).toContain("token=");
    expect(screen.getByText(/expires Jul 6, 2026/i)).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Role for dev@example.com"), "admin");
    await waitFor(() => expect(api.updateMemberRole).toHaveBeenCalledWith(organization.id, member.userId, "admin"));
  });

  it("accepts an invitation link token and reloads available workspaces", async () => {
    const api = makeApi();
    render(<WorkspacePage api={api} currentUserId={owner.userId} invitationToken={"x".repeat(32)} />);

    await userEvent.click(await screen.findByRole("button", { name: "Accept invitation" }));

    expect(await screen.findByText("Invitation accepted.")).toBeInTheDocument();
    expect(api.acceptInvitation).toHaveBeenCalledWith("x".repeat(32));
    expect(api.bootstrap).toHaveBeenCalledTimes(2);
  });

  it("clears a generated invitation when the workspace changes", async () => {
    const api = makeApi({ bootstrap: vi.fn().mockResolvedValue({ workspaces: [personal, organization], selectedWorkspaceId: organization.id }) });
    render(<WorkspacePage api={api} currentUserId={owner.userId} />);
    await userEvent.type(await screen.findByLabelText("Invitee email"), "dev@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Create invitation link" }));
    expect(await screen.findByLabelText("Invitation link")).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Current workspace"), personal.id);

    expect(screen.queryByLabelText("Invitation link")).not.toBeInTheDocument();
  });

  it("prevents admins from promoting members to owner or editing owners", async () => {
    const adminWorkspace = { ...organization, role: "admin" as const };
    const member = { ...owner, userId: "e4609c0a-f126-4a64-a2db-197bb425a45d", email: "dev@example.com", role: "member" as const };
    const api = makeApi({
      bootstrap: vi.fn().mockResolvedValue({ workspaces: [adminWorkspace], selectedWorkspaceId: adminWorkspace.id }),
      listMembers: vi.fn().mockResolvedValue([owner, member]),
    });
    render(<WorkspacePage api={api} currentUserId={member.userId} />);

    const memberRole = await screen.findByLabelText("Role for dev@example.com");
    expect(memberRole.querySelector('option[value="owner"]')).not.toBeInTheDocument();
    expect(screen.getByLabelText("Role for ada@example.com")).toBeDisabled();
  });

  it("retries a failed member load and clears the stale error", async () => {
    const listMembers = vi.fn().mockRejectedValueOnce(new Error("Network unavailable")).mockResolvedValueOnce([owner]);
    const api = makeApi({ bootstrap: vi.fn().mockResolvedValue({ workspaces: [organization], selectedWorkspaceId: organization.id }), listMembers });
    render(<WorkspacePage api={api} currentUserId={owner.userId} />);

    expect(await screen.findByText("Network unavailable")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry members" }));

    expect(await screen.findByText("ada@example.com")).toBeInTheDocument();
    expect(screen.queryByText("Network unavailable")).not.toBeInTheDocument();
    expect(listMembers).toHaveBeenCalledTimes(2);
  });

  it("requires confirmation before removing a member", async () => {
    const member = { ...owner, userId: "e4609c0a-f126-4a64-a2db-197bb425a45d", email: "dev@example.com", role: "member" as const };
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    const api = makeApi({ bootstrap: vi.fn().mockResolvedValue({ workspaces: [organization], selectedWorkspaceId: organization.id }), listMembers: vi.fn().mockResolvedValue([owner, member]) });
    render(<WorkspacePage api={api} currentUserId={owner.userId} />);
    const remove = await screen.findByRole("button", { name: "Remove" });

    await userEvent.click(remove);
    expect(api.removeMember).not.toHaveBeenCalled();
    await userEvent.click(remove);

    expect(confirm).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(api.removeMember).toHaveBeenCalledWith(organization.id, member.userId));
  });

  it("reports clipboard success and provides a manual-copy fallback", async () => {
    const writeText = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const api = makeApi({ bootstrap: vi.fn().mockResolvedValue({ workspaces: [organization], selectedWorkspaceId: organization.id }) });
    render(<WorkspacePage api={api} currentUserId={owner.userId} />);
    await userEvent.type(await screen.findByLabelText("Invitee email"), "dev@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Create invitation link" }));
    const copy = await screen.findByRole("button", { name: "Copy invitation link" });

    await userEvent.click(copy);
    expect(await screen.findByText("Invitation link copied.")).toBeInTheDocument();
    await userEvent.click(copy);
    expect(await screen.findByText("Copy failed. Select and copy the link manually.")).toBeInTheDocument();
  });

  it("tracks concurrent member mutations independently", async () => {
    const first = { ...owner, userId: "e4609c0a-f126-4a64-a2db-197bb425a45d", email: "one@example.com", role: "member" as const };
    const second = { ...owner, userId: "f4609c0a-f126-4a64-a2db-197bb425a45d", email: "two@example.com", role: "member" as const };
    const resolvers = new Map<string, (member: WorkspaceMember) => void>();
    const updateMemberRole = vi.fn((_workspaceId: string, userId: string) => new Promise<WorkspaceMember>((resolve) => resolvers.set(userId, resolve)));
    const api = makeApi({
      bootstrap: vi.fn().mockResolvedValue({ workspaces: [organization], selectedWorkspaceId: organization.id }),
      listMembers: vi.fn().mockResolvedValue([owner, first, second]),
      updateMemberRole,
    });
    render(<WorkspacePage api={api} currentUserId={owner.userId} />);
    const firstRole = await screen.findByLabelText("Role for one@example.com");
    const secondRole = screen.getByLabelText("Role for two@example.com");

    await userEvent.selectOptions(firstRole, "admin");
    await userEvent.selectOptions(secondRole, "admin");
    expect(firstRole).toBeDisabled();
    expect(secondRole).toBeDisabled();

    await act(async () => resolvers.get(first.userId)?.({ ...first, role: "admin" }));
    expect(firstRole).not.toBeDisabled();
    expect(secondRole).toBeDisabled();
    await act(async () => resolvers.get(second.userId)?.({ ...second, role: "admin" }));
    expect(secondRole).not.toBeDisabled();
  });
});
