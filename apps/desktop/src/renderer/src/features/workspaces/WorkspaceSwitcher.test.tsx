import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

const workspaces = [
  { id: "a4609c0a-f126-4a64-a2db-197bb425a45d", name: "My workspace", slug: "mine", type: "personal" as const, role: "owner" as const, createdAt: "2026-06-29T00:00:00.000Z" },
  { id: "b4609c0a-f126-4a64-a2db-197bb425a45d", name: "Platform", slug: "platform", type: "organization" as const, role: "admin" as const, createdAt: "2026-06-29T00:00:00.000Z" },
];

describe("WorkspaceSwitcher", () => {
  it("switches explicitly between personal and organization workspaces", async () => {
    const onSelect = vi.fn();
    render(<WorkspaceSwitcher workspaces={workspaces} selectedWorkspaceId={workspaces[0].id} onSelect={onSelect} />);

    await userEvent.selectOptions(screen.getByLabelText("Current workspace"), workspaces[1].id);

    expect(onSelect).toHaveBeenCalledWith(workspaces[1].id);
    expect(document.querySelector('optgroup[label="Personal workspace"]')).toBeInTheDocument();
    expect(document.querySelector('optgroup[label="Organization workspace"]')).toBeInTheDocument();
  });
});
