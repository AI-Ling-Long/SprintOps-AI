import type { Workspace } from "@sprintops/contracts";

type WorkspaceSwitcherProps = {
  workspaces: Workspace[];
  selectedWorkspaceId: string;
  onSelect: (workspaceId: string) => void;
  disabled?: boolean;
};

export function WorkspaceSwitcher({ workspaces, selectedWorkspaceId, onSelect, disabled = false }: WorkspaceSwitcherProps) {
  const personal = workspaces.filter((workspace) => workspace.type === "personal");
  const organizations = workspaces.filter((workspace) => workspace.type === "organization");

  return (
    <label className="workspace-switcher">
      <span className="field-label">Current workspace</span>
      <select
        aria-label="Current workspace"
        value={selectedWorkspaceId}
        disabled={disabled}
        onChange={(event) => onSelect(event.target.value)}
      >
        {personal.length > 0 && (
          <optgroup label="Personal workspace">
            {personal.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
          </optgroup>
        )}
        {organizations.length > 0 && (
          <optgroup label="Organization workspace">
            {organizations.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
          </optgroup>
        )}
      </select>
    </label>
  );
}
