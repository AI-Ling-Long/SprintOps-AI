# SprintOps AI — UI Registry

Read this file before creating a reusable component. Update it after a component is added or materially changed.

## Status Labels

- **Legacy:** exists in `src/renderer/` and belongs to the JavaScript prototype.
- **Target:** part of the React/Vite architecture.
- **Planned:** specified but not implemented.

## Legacy Prototype Surfaces

| Surface | Location | Status | Notes |
| --- | --- | --- | --- |
| Authentication shell | `src/renderer/index.html`, `index.js`, `styles.css` | Legacy | Email/password and OAuth UI; session semantics require replacement |
| Dashboard shell/sidebar | `src/renderer/index.html`, `dashboard.js`, `dashboard.css` | Legacy | Static HTML and string-template navigation |
| Goals view | `src/renderer/dashboard.js` | Legacy | LocalStorage-backed prototype |
| Projects view | `src/renderer/dashboard.js` | Legacy | LocalStorage-backed prototype |
| Git Activity view | `src/renderer/dashboard.js` | Legacy | No repository ingestion |
| AI Feedback view | `src/renderer/dashboard.js` | Legacy | Toggle only; no AI pipeline |
| Analytics view | `src/renderer/dashboard.js` | Legacy | Placeholder visualization |
| Streaks view | `src/renderer/dashboard.js` | Legacy | Local check-in calculation |
| Settings view | `src/renderer/dashboard.js` | Legacy | Local-only profile/preferences |

Legacy surfaces may inform visual migration but are not reusable target components.

## Target Foundations

| Component | Target path | Status | Responsibility |
| --- | --- | --- | --- |
| `AppShell` | `apps/desktop/src/renderer/src/components/layout/AppShell.tsx` | Target | Sidebar, topbar, authenticated workspace context, navigation; tested loading/error/switching states |
| `WorkspaceSwitcher` | `apps/desktop/src/renderer/src/features/workspaces/WorkspaceSwitcher.tsx` | Target | Labeled personal/organization selection using semantic select/optgroups; disabled variant; keyboard native |
| `ProjectSwitcher` | `.../components/projects/ProjectSwitcher.tsx` | Planned | Project context selection |
| `PageHeader` | `.../components/layout/PageHeader.tsx` | Planned | Title, context, primary action |
| `AsyncBoundary` | `.../components/feedback/AsyncBoundary.tsx` | Planned | Loading, error, empty, stale states |
| `ConfirmDialog` | `.../components/overlays/ConfirmDialog.tsx` | Planned | Destructive and approval confirmation |
| `SourceDrawer` | `.../components/intelligence/SourceDrawer.tsx` | Planned | Canonical evidence inspection |

## Target Domain Components

| Component | Status | Responsibility |
| --- | --- | --- |
| `WorkspacePage` | Target | Organization creation, invitation acceptance/copying, member loading, roles and removal with permission/error/pending states |
| `ProjectsPage` | Target | Workspace-scoped project list/create with loading, empty, error, permission and pending states |
| `BacklogTable` | Planned | Sortable/filterable work-item list |
| `WorkItemEditor` | Planned | Create/edit work item and acceptance criteria |
| `SprintBoard` | Planned | Accessible status board |
| `SprintGoalCard` | Planned | Sprint goal, dates, health, and scope state |
| `WorkItemCard` | Planned | Work item with owner, estimate, blockers, evidence |
| `RepositoryPicker` | Planned | Explicit folder selection and consent preview |
| `RepositoryConnectionCard` | Planned | Local/GitHub state and last synchronization |
| `ActivityTimeline` | Planned | Task and repository activity stream |
| `SprintBriefing` | Planned | Structured AI report |
| `FindingCard` | Planned | Risk/progress/blocker/action with evidence |
| `EvidenceBadge` | Planned | Source count, freshness, and inspection action |
| `AgentRunProgress` | Planned | Real graph stage and failure status |
| `ApprovalReview` | Planned | Exact before/after proposed mutation review |

## Registration Rule

When a target component is implemented, replace `Planned` with `Target` and record:

- Exact file path.
- Public props or contract.
- Variants and states.
- Accessibility behavior.
- Tokens used.
- Tests or stories verifying it.

Do not register one-off page markup as a reusable component.
