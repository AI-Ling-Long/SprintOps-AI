# SprintOps AI — Project Overview

This file is the product source of truth. SprintOps AI is the only product in this repository. References to JobPilot, CodeBattle, job hunting, or unrelated applications are obsolete and must not influence implementation.

## Product Definition

SprintOps is a desktop-native sprint copilot that connects a developer's local work to individual and team sprint commitments.

It combines:

- A first-party backlog, sprint, task, and project-management system.
- Local Git and GitHub development signals.
- Evidence-backed AI analysis using LangChain.js, LangGraph, OpenRouter, and Pinecone.
- Personal and organization workspaces backed by Supabase.

SprintOps is not a generic employee-monitoring product and is not a wrapper around Jira or Linear. It owns the sprint workflow while using development activity as evidence for better planning and delivery decisions.

## Problem

Sprint plans and actual development work drift apart. Developers update code, branches, pull requests, reviews, and CI systems, while task boards rely on manual status updates. This creates recurring problems:

- Developers spend time reconstructing status for stand-ups and reviews.
- Team leads discover blockers and scope drift late.
- Task status can disagree with repository reality.
- Sprint retrospectives depend on memory instead of evidence.
- Existing reports show counts without explaining what changed or what to do next.

SprintOps closes that gap by relating sprint commitments to repository activity and generating cited, reviewable insights.

## Core Promise

> Make sprint management easier for developers and teams by turning backlog state and real development activity into trustworthy progress, risk, blocker, and next-action guidance.

## Target Users

### Individual developer

- Creates a personal workspace and personal projects.
- Plans work in backlogs and sprints.
- Connects local repositories and GitHub.
- Reviews a private activity timeline and AI-generated sprint guidance.

### Development team

- Creates an organization workspace.
- Invites members and assigns roles.
- Plans projects and sprints collaboratively.
- Links tasks to branches, commits, and pull requests.
- Shares check-ins, blockers, and approved AI summaries.

### Team lead or workspace administrator

- Manages organization membership and project access.
- Plans sprint scope and reviews sprint health.
- Uses evidence-backed reports to identify delivery risk.
- Cannot use SprintOps to rank developers by commit volume or raw activity counts.

## Workspace Model

Every user receives a personal workspace and may belong to organization workspaces.

- A workspace is the tenant and authorization boundary.
- A personal workspace normally has one member.
- An organization workspace has members with roles.
- Projects belong to exactly one workspace.
- Sprints belong to exactly one project.
- Work items belong to a project and may be assigned to a sprint.
- Repository connections belong to a project.

Initial roles:

- `owner`: full workspace control, including deletion and ownership transfer.
- `admin`: membership, project, and integration management.
- `member`: normal project and sprint participation.

## Domain Vocabulary

- **Project:** a body of development work containing a backlog, sprints, members, repositories, and reports.
- **Sprint:** a time-boxed delivery period with a goal and committed work items.
- **Work item:** a story, task, bug, or subtask tracked by SprintOps.
- **Sprint commitment:** a work item accepted into an active sprint with an owner, status, estimate, and acceptance criteria.
- **Repository activity:** metadata about repositories, branches, commits, pull requests, reviews, and CI results. It excludes source files, diffs, secrets, and terminal history.
- **Check-in:** a developer-authored progress, plan, or blocker update.
- **Sprint knowledge:** task descriptions, acceptance criteria, check-ins, decisions, summaries, blockers, and retrospective findings that can be retrieved by the AI system.
- **Evidence:** a specific SprintOps or repository record supporting an AI claim.
- **Agent run:** one bounded execution of an AI workflow, including tool calls, evidence, output, cost, and status.

## Core Product Loop

1. A user signs in and selects a personal or organization workspace.
2. The user creates a project and invites collaborators when needed.
3. The team adds, prioritizes, and estimates work in the backlog.
4. The team creates a sprint, defines its goal, and commits work items.
5. Developers explicitly connect local Git repositories and GitHub repositories.
6. SprintOps collects allowed repository metadata and relates it to work items.
7. Developers add check-ins and blockers where repository evidence is insufficient.
8. The Sprint Risk Agent analyzes current state and retrieves relevant history.
9. SprintOps displays cited progress, risks, blockers, confidence, and next actions.
10. A human reviews and approves any proposed mutation.
11. At sprint close, SprintOps generates an evidence-backed review and retrospective input.

## Primary Screens

### Authentication

- Email/password, Google, and GitHub sign-in through Supabase Auth.
- Valid session restoration; a cached public user object is never treated as authentication.

### Workspace switcher

- Personal workspace.
- Organization workspaces.
- Create organization, invite member, and manage roles.

### Dashboard

- Active sprint goal and dates.
- Committed, completed, in-review, blocked, and at-risk work.
- Recent repository and task activity.
- Latest AI sprint briefing with evidence links.
- Personal view by default; organization view only when authorized.

### Projects

- Project list and project overview.
- Members, connected repositories, current sprint, and recent reports.

### Backlog

- Create, edit, prioritize, estimate, assign, and filter work items.
- Types: story, task, bug, subtask.
- Initial fixed workflow: backlog, ready, in progress, review, done.

### Sprint planning

- Create a sprint and define its goal, start date, and end date.
- Select backlog items and review capacity.
- Start, complete, or cancel a sprint.
- Record scope changes after sprint start.

### Sprint board

- Work items grouped by status.
- Assignee, estimate, blockers, repository links, and evidence indicators.
- Manual state changes remain authoritative unless a human approves an AI proposal.

### Repositories

- Explicit local folder selection; no automatic whole-disk scanning.
- Local repository validation and metadata preview.
- GitHub installation/connection and remote-repository selection.
- Work-item linking based on explicit links and recognized task keys.

### Sprint Intelligence

- Generate an on-demand or post-sync sprint briefing.
- Progress summary.
- At-risk commitments with severity and confidence.
- Blockers and missing evidence.
- Recommended next actions.
- Sources linking every substantive claim to tasks, check-ins, commits, pull requests, reviews, or CI records.

### Settings

- Profile and notification preferences.
- Workspace members and roles.
- GitHub integration.
- OpenRouter/Pinecone configuration is server-side only and never exposed to Electron.
- Data export and deletion.

## First AI Workflow

The first production AI workflow is the **Sprint Risk Agent**.

It answers:

- What changed since the last briefing?
- Which sprint commitments are progressing, blocked, stale, or at risk?
- What evidence supports each conclusion?
- What information is missing?
- What should the individual or team do next?

The agent is read-only by default. It may propose task changes, but every mutation requires explicit user approval.

## AI Output Contract

Each sprint briefing contains:

- `summary`: concise sprint-level status.
- `progress`: evidence-backed completed or advancing work.
- `risks`: severity, confidence, affected work items, rationale, and evidence.
- `blockers`: confirmed blockers and missing dependencies.
- `nextActions`: prioritized recommendations with owners where known.
- `missingInformation`: questions or absent signals that prevent a reliable conclusion.
- `sources`: normalized references to the supporting records.

Unsupported claims must be omitted or represented as missing information. The model must not invent delivery status.

## Data Boundaries

SprintOps may collect and synchronize:

- Repository identity and configured local-repository mapping.
- Branch names and HEAD metadata.
- Commit hashes, authorship, timestamps, and commit messages.
- Pull-request identifiers, titles, states, review state, and links.
- CI/check names, states, and links.
- Explicit links between repository records and work items.
- User-authored check-ins, decisions, blockers, and summaries.

SprintOps must not upload:

- Source-file contents.
- Git diffs or patches.
- Secrets, credentials, environment-file values, or tokens.
- Terminal history or arbitrary shell output.
- Unrelated filesystem contents.

Supabase PostgreSQL is the source of truth for relational application data. Pinecone stores vectorized sprint knowledge and retrieval metadata. Pinecone is not the source of truth for tasks or sprint state.

## Initial Scope

### In scope

- Electron desktop application with React/Vite renderer.
- Personal and organization workspaces.
- Roles and membership.
- Projects, backlog, sprints, work items, assignments, and blockers.
- Local Git repository selection and metadata ingestion.
- GitHub repository, pull-request, review, and CI metadata.
- Check-ins and work-item/repository linking.
- Sprint Risk Agent using LangChain.js and LangGraph.
- OpenRouter chat and embedding models.
- Pinecone semantic retrieval.
- Supabase Auth and PostgreSQL.
- Evidence citations, approval gates, traceability, and evaluations.

### Deferred

- GitLab and Bitbucket.
- Custom workflows and arbitrary custom fields.
- Jira or Linear synchronization.
- Automatic source-code ingestion.
- Automatic task mutation without approval.
- Employee scoring, ranking, or performance evaluation.
- Mobile applications.
- Full offline-first synchronization.
- Billing and subscription management.

## Success Criteria

### Product

- A new user can create a workspace, project, sprint, task, and repository connection without external setup beyond Git/GitHub credentials.
- A developer can understand sprint status without manually reconstructing repository activity.
- Personal and organization access controls prevent cross-workspace data exposure.

### AI quality

- Every substantive finding cites at least one retrievable source.
- Unsupported claims are rejected instead of guessed.
- At least 80% of displayed risk findings are accepted as useful during pilot evaluation.
- Retrieval respects workspace boundaries on every query.
- The same evidence produces a structurally valid output under repeated evaluation.

### Engineering

- Secrets remain on the hosted backend.
- Electron never enables renderer Node integration.
- Local repository access is explicit and allowlisted.
- Agent runs are bounded, observable, retryable, and auditable.

## Current Implementation Status

The repository currently contains an early JavaScript Electron prototype:

- Supabase email/password and OAuth UI exists but session persistence is incomplete.
- The dashboard, goals, projects, analytics, and settings screens are prototype views.
- Workspace data is stored in `localStorage`.
- GitHub sign-in exists, but repository discovery and activity ingestion do not.
- The `repositories` collection is never populated.
- No AI, LangChain.js, LangGraph, OpenRouter, Pinecone, queue, or RAG implementation exists.
- The `react/` directory is an unintegrated Vite starter.
- The Drizzle schema contains only a legacy users table and is not used by the app.
- Automated tests, CI, packaging, and production deployment are absent.

Treat existing code as prototype evidence, not as the target architecture.
