# SprintOps AI — Progress Tracker

Update this file after each completed vertical slice.

## Current Status

- **Product phase:** Phases 0, 1, and 2 complete.
- **Current code:** Active Electron/Vite/React/TypeScript workspace alongside retained legacy prototype code.
- **Target:** Electron + React/Vite + TypeScript desktop client, hosted Node API/worker, Supabase, OpenRouter, LangChain.js/LangGraph, and Pinecone.
- **Last completed:** Phase 2 multi-tenant workspace foundation.
- **Next:** Phase 3 backlog and sprint management.

## Confirmed Decisions

- SprintOps is the sole product in this repository.
- Positioning: desktop-native sprint copilot connecting local work to sprint commitments.
- Personal and organization workspaces ship together.
- SprintOps owns backlog, sprint, and task management rather than integrating with Jira/Linear initially.
- Local Git and GitHub are the first repository sources.
- Supabase Auth handles identity.
- Supabase PostgreSQL stores relational application data.
- OpenRouter supplies chat and embedding models.
- Pinecone is the vector database.
- LangChain.js and LangGraph implement the agentic RAG workflow.
- The first AI workflow is evidence-backed sprint risk analysis.
- AI mutations require explicit approval.
- Source code, diffs, secrets, and terminal history are never uploaded.
- React/Vite replaces the legacy renderer.
- No SQLite or full offline-first synchronization is required initially.

## Existing Prototype

### Present

- [x] Electron window and secure baseline flags.
- [x] Email/password login and signup UI.
- [x] Google and GitHub OAuth flow prototype.
- [x] Dashboard/sidebar prototype.
- [x] LocalStorage goals, projects, check-ins, and preferences.
- [x] Supabase and Drizzle dependencies.
- [x] React/Vite starter directory.

### Missing or incomplete

- [x] Multi-tenant workspace schema and authorization.
- [ ] Backlog, sprint, and work-item domain.
- [ ] Local repository picker and Git metadata reader.
- [ ] GitHub App and remote activity ingestion.
- [ ] Hosted API deployment and background worker.
- [ ] OpenRouter model integration.
- [ ] Pinecone indexing and retrieval.
- [ ] LangChain.js/LangGraph agent.
- [ ] Evidence-backed outputs and approvals.
- [ ] CI, packaging, and deployment.

## Target Build Progress

### Phase 0 — Alignment

- [x] Replace obsolete project context.
- [x] Define target architecture and data boundaries.
- [x] Define UI rules and tokens.
- [x] Create project-specific agent instructions.
- [x] Define migration issue set and target package structure.

### Phase 1 — Secure Desktop Foundation

- [x] Integrate React/Vite renderer.
- [x] Add typed IPC contracts.
- [x] Add hosted API client.
- [x] Repair Supabase session lifecycle.

### Phase 2 — Workspaces

- [x] Profiles, workspaces, memberships, roles, and invitations.
- [x] Workspace authorization and RLS.
- [x] Workspace and project UI.

### Phase 3 — Sprint Management

- [ ] Work-item model and backlog.
- [ ] Sprint lifecycle and baseline scope.
- [ ] Sprint board and blockers.

### Phase 4 — Local Git

- [ ] Explicit repository folder picker.
- [ ] Allowlisted Git metadata reader.
- [ ] Device mapping and incremental synchronization.

### Phase 5 — GitHub

- [ ] GitHub App.
- [ ] Pull requests, reviews, CI, and webhooks.
- [ ] Work-item linking.

### Phase 6 — Knowledge Pipeline

- [ ] Knowledge-document formatters and versions.
- [ ] OpenRouter embedding adapter.
- [ ] Pinecone workspace namespaces and indexing jobs.

### Phase 7 — Sprint Risk Agent

- [ ] Authorized deterministic tools.
- [ ] LangGraph workflow.
- [ ] Structured findings and canonical sources.
- [ ] Approval gates, feedback, tracing, and evaluations.

### Phase 8 — Sprint Review

- [ ] Sprint outcome comparison.
- [ ] Retrospective generation and human editing.
- [ ] Approved retrospective indexing.

### Phase 9 — Production

- [ ] Packaging, signing, and updates.
- [ ] Hosted deployment and job recovery.
- [ ] Security, accessibility, performance, backup, export, and deletion review.

## Known Risks

- The API currently runs as a local development service; hosted deployment, rate limiting, and production observability remain Phase 9 work.
- The Phase 2 schema models identities, workspaces, memberships, invitations, and projects; sprint/work-item persistence remains Phase 3 work.
- GitHub repository authorization still requires the separate GitHub App planned for Phase 5.
- Pinecone is eventually consistent; read-after-write behavior must be tested and bounded.
- AI risk conclusions can become surveillance-like if they are presented as individual performance scores.
- OpenRouter model capabilities and routing can change; validate tools, structured output, context, and embedding dimensions at startup/deployment.

## Verification Notes

Phase 2 verification covers domain authorization, personal-workspace privacy, invitation lifecycle, idempotent acceptance, audit records, owner preservation under concurrent mutations, API authentication/envelopes, workspace/member UI, project UI, and shared-shell integration. Migrations 0001–0002 were applied to the configured PostgreSQL database. Rolled-back two-user database checks proved cross-workspace RLS denial/member access and rejection of personal-workspace invitations/additional members. Visual automation remains unavailable in the current execution environment.
