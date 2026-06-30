# SprintOps AI — UI Rules

SprintOps is a desktop application for information-dense development workflows. The interface should feel operational, calm, and inspectable rather than decorative.

## Application Shell

- Persistent left sidebar on desktop.
- Top context bar for workspace, project, sprint, sync state, and primary action.
- Main content scrolls independently from navigation.
- Minimum supported window: 1024 × 700.
- Optimize primary layouts for 1280–1600px widths.
- Use compact density without reducing touch targets below 36px.

## Navigation

Primary destinations:

- Dashboard
- Projects
- Backlog
- Sprint
- Repositories
- Intelligence
- Settings

Navigation reflects the selected workspace and project. Do not hide authorization failures by silently switching workspaces.

## Screen Responsibilities

### Dashboard

- Active sprint health and goal.
- Work by status.
- Confirmed blockers and risks.
- Recent development activity.
- Latest AI briefing.

### Backlog

- Dense, sortable list.
- Fast creation and inline edits.
- Type, priority, estimate, assignee, and sprint state visible.
- Filters are reflected in the URL/router state where practical.

### Sprint board

- Columns: ready, in progress, review, done.
- Backlog remains outside an active board.
- Cards show work-item key, title, owner, estimate, blockers, and evidence state.
- Drag/drop is optional; accessible status controls are mandatory.

### Repositories

- Explain what metadata is collected before folder selection.
- Show local and GitHub connection separately.
- Display last sync, errors, linked project, branch, and remote identity.
- Never display or preview source contents.

### Intelligence

- Findings grouped into progress, risks, blockers, and next actions.
- Every finding exposes evidence in one interaction.
- Show confidence and freshness without implying mathematical certainty.
- Clearly distinguish AI-generated content from canonical task state.
- Provide accept, reject, and correct feedback actions.

## Layout and Spacing

- Use an 8px base spacing rhythm.
- Main page padding: 24px at standard desktop width, 16px at minimum width.
- Section gap: 24px.
- Card padding: 16px or 20px depending on density.
- Do not nest more than two bordered card levels.
- Prefer split panes, tables, and drawers over long stacks of disconnected cards.

## Typography

- Use Inter when bundled/available; fall back to the system sans-serif stack without blocking startup.
- Page title: 24px/32px, weight 650–700.
- Section title: 16px/24px, weight 600.
- Body: 14px/20px, weight 400–500.
- Metadata: 12px/16px, weight 400–500.
- IDs, branches, commit hashes, and command-like text use the monospace token.

## Color Semantics

- Purple is the primary interaction accent.
- Green means completed/healthy.
- Amber means attention or moderate risk.
- Red means blocked, failed, or high risk.
- Blue means informational or in progress.
- Gray means neutral, inactive, or missing data.
- Never use color as the only state indicator; pair it with text or icons.

## Cards and Surfaces

- Default surfaces are neutral.
- Use borders and small elevation changes rather than heavy shadows.
- Reserve tinted surfaces for status summaries and selected states.
- AI findings use the same design system as canonical content but include an explicit AI label.

## Tables and Lists

- Use sticky headers for long lists.
- Provide keyboard navigation and visible row focus.
- Keep row height between 40px and 52px.
- Avoid alternating row colors; use hover, selected, and divider states.
- Columns with exact data align consistently.
- Destructive row actions are not the primary visible action.

## Forms

- Labels are always visible; placeholders do not replace labels.
- Validate on blur/submit and keep the entered value after recoverable errors.
- Explain permissions or collection boundaries before an integration action.
- Require confirmation for sprint close, workspace removal, repository disconnect, and destructive data operations.

## Loading, Empty, Error, and Stale States

Every data surface supports:

- Initial loading.
- Empty state with a relevant next action.
- Recoverable error with retry.
- Permission denied.
- Stale/syncing state when local or provider data may lag.

Do not display fabricated sample values in a production state.

## AI Evidence UX

- Findings show severity, confidence, freshness, and affected work items.
- Evidence opens a source drawer containing canonical records.
- Retrieved snippets are visually separated from model rationale.
- Unsupported or incomplete analysis is shown as missing information.
- Proposed mutations display an exact before/after diff of task fields and require approval.
- Rejected findings remain available for evaluation feedback without cluttering the active report.

## Accessibility

- Meet WCAG AA contrast.
- All functionality is keyboard accessible.
- Visible focus rings use the focus token.
- Icon-only controls have accessible names and tooltips.
- Drag/drop always has a non-drag alternative.
- Status charts have text/table equivalents.
- Respect reduced-motion preferences.

## Motion

- Use short 120–200ms transitions for state changes.
- Avoid ambient animation in operational screens.
- Streaming AI output may show progress by graph stage, not fake typing.

## Prohibited Patterns

- No raw hex values in components.
- No source-code display in repository intelligence.
- No commit-count leaderboards or developer ranking UI.
- No hidden automatic task mutations.
- No inaccessible drag-only sprint board.
- No generic chat interface as the only way to access findings.
- No silent workspace or project switching.
- No raw provider errors or secret values.
