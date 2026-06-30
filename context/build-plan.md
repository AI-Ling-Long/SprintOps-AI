# SprintOps AI — Build Plan

## Token-Efficient Delivery Principle

Optimize future work for short Codex turns and low context usage. Use horizontal micro-steps rather than vertical slices.

- One request changes one concern and normally 1–2 files.
- Target 2–3 minutes of code generation per micro-step; verification time may be longer.
- Reuse existing contracts and patterns instead of redesigning them in every prompt.
- Run the narrow package check after each micro-step.
- Run full lint, typecheck, tests, and build only once at the end of a phase.
- Update context once per completed phase, not after every micro-step.
- Do not request architecture, planning, review, and implementation simultaneously unless the decision is genuinely unresolved.

## Phase 0 — Product and Repository Alignment

### 0.1 Canonical documentation

- Replace obsolete JobPilot context.
- Create a SprintOps-specific `AGENTS.md`.
- Record the desktop-native product definition, data boundaries, and target architecture.
- Track `context/` and `AGENTS.md` so product and engineering guidance changes are reviewable.

### 0.2 Target workspace decision

- Adopt TypeScript for all new target code.
- Define the migration path from the current JavaScript prototype.
- Introduce a workspace structure without moving unrelated files prematurely.
- Add shared lint, typecheck, test, and build commands.

**Exit criteria:** a new contributor can distinguish current prototype code from target architecture and can run documented checks.

### Phase 0 migration issue set

1. **Secure desktop foundation:** complete and stabilize the active `apps/desktop` React/Electron application and `packages/contracts` IPC boundary.
2. **Workspace domain:** add `apps/api`, `packages/domain`, and `packages/db` only when the first workspace/project slice begins.
3. **Local Git:** add explicit repository selection and an allowlisted metadata reader behind typed IPC.
4. **Hosted intelligence:** add `apps/worker` and `packages/ai` with canonical documents, OpenRouter embeddings, Pinecone retrieval, and the bounded Sprint Risk Agent.
5. **Production hardening:** add CI, packaging, signing, updates, deployment, recovery, and security verification.

Create packages when their phase starts; do not add empty scaffolding merely to mirror the target tree.

## Phase 1 — Secure Desktop Foundation

### 1.1 React/Vite renderer integration

- Replace the unintegrated Vite starter with the real renderer entry point.
- Preserve Electron security settings.
- Rebuild authentication and application chrome as React components.
- Add typed renderer routing and error boundaries.

### 1.2 Typed IPC bridge

- Define Zod-validated IPC contracts.
- Expose only explicit repository and OAuth operations.
- Add tests for invalid channel names and malformed payloads.
- Remove the stale `window.jarvis` naming.

### 1.3 Hosted API client

- Add an authenticated API client in the renderer.
- Store and refresh Supabase sessions correctly.
- Remove trust in cached public user objects.
- Add request correlation IDs and standardized errors.

**Phase result:** sign in, restart the app, restore a valid session, sign out, and see a typed application shell.

## Phase 2 — Multi-Tenant Workspace Foundation

### 2.1 Relational schema

- Profiles.
- Personal and organization workspaces.
- Memberships and roles.
- Invitations.
- Projects and project members.
- Audit records.

### 2.2 Authorization

- Server-side session validation.
- Workspace membership policy.
- Owner/admin/member capabilities.
- RLS defense in depth.
- Cross-workspace denial tests.

### 2.3 Workspace UI

- Workspace switcher.
- Personal workspace creation on first login.
- Organization creation.
- Invite, accept, remove, and role-change flows.
- Project creation for individual or group work.

**Phase result:** two users can collaborate inside an organization while remaining unable to access each other's personal workspace.

## Phase 3 — Backlog and Sprint Management

### Fast sequence

1. Add work-item enums and Zod contracts; run contract tests.
2. Add work-item and dependency tables; generate one migration.
3. Add sprint and sprint-scope tables to the same migration.
4. Add work-item lifecycle domain rules; run domain tests.
5. Add sprint lifecycle domain rules; run domain tests.
6. Add work-item CRUD repository methods; run DB typecheck.
7. Add sprint repository methods; run DB typecheck.
8. Add work-item API routes; run API tests.
9. Add sprint API routes; run API tests.
10. Add backlog list/editor UI; run focused renderer tests.
11. Add sprint planning UI; run focused renderer tests.
12. Add sprint board status controls; run focused renderer tests.
13. Add blockers/dependencies UI; run focused renderer tests.
14. Run the phase-wide verification gate and update context.

### 3.1 Work items

- Story, task, bug, and subtask types.
- Title, description, acceptance criteria, priority, estimate, assignee, and parent.
- Fixed workflow: backlog, ready, in progress, review, done.
- Dependency/blocker links.

### 3.2 Backlog

- Create, edit, delete, prioritize, assign, estimate, and filter work.
- Optimistic UI only when the mutation is safely reversible.
- Activity history for meaningful field changes.

### 3.3 Sprints

- Create with goal, start date, and end date.
- Commit backlog items and capture baseline state.
- Start, complete, and cancel lifecycle.
- Track scope added or removed after start.

### 3.4 Sprint board

- Board/list views.
- Status transitions.
- Blockers and dependencies.
- Evidence and repository-link indicators.

**Phase result:** a personal user or organization can plan and run a sprint entirely inside SprintOps.

## Phase 4 — Local Repository Integration

### Fast sequence

1. Add repository IPC contracts; run contract tests.
2. Add the native folder-picker handler and preload method.
3. Add repository path-token storage.
4. Add Git availability/worktree validation with tests.
5. Add remote/root/current-branch readers with tests.
6. Add HEAD and commit-metadata readers with tests.
7. Add incremental checkpoint storage.
8. Add repository connection tables and migration.
9. Add repository mapping API routes.
10. Add repository picker/consent UI.
11. Add sync status and error UI.
12. Run security checks proving no files/diffs/secrets are exposed.
13. Run the phase-wide verification gate and update context.

### 4.1 Explicit folder selection

- Electron-native folder picker.
- Path token rather than arbitrary renderer path access.
- Validate repository worktree and Git availability.
- Preview synchronized metadata before confirmation.

### 4.2 Git metadata reader

- Repository root and remote identity.
- Current branch and HEAD.
- Allowed commit metadata.
- Incremental cursor/checkpoint.
- No source, diff, secret, or terminal ingestion.

### 4.3 Repository mapping

- Associate a local repository with a SprintOps project.
- Store device-specific mapping separately from provider identity.
- Synchronize metadata idempotently.
- Show last successful sync and actionable errors.

**Phase result:** select a local repository and see branches and commits connected to a SprintOps project.

## Phase 5 — GitHub Integration

### Fast sequence

1. Add GitHub App configuration validation.
2. Add installation and repository tables.
3. Add webhook-delivery table and uniqueness constraint.
4. Add webhook signature validation test and handler.
5. Add installation/repository synchronization adapter.
6. Add pull-request ingestion adapter.
7. Add review ingestion adapter.
8. Add CI/check ingestion adapter.
9. Add task-key parser and tests.
10. Add explicit/inferred activity-link persistence.
11. Add GitHub connection settings UI.
12. Add linked activity UI to work items.
13. Run webhook replay/cross-workspace tests.
14. Run the phase-wide verification gate and update context.

### 5.1 Separate identity from repository authorization

- Keep Supabase GitHub OAuth for sign-in identity only.
- Add a GitHub App for repository installation and scoped access.
- Never treat a sign-in provider token as a durable integration credential.

### 5.2 Remote activity

- Repositories.
- Pull requests.
- Reviews.
- CI/check results.
- Webhook validation, idempotency, and replay protection.

### 5.3 Work-item linking

- Explicit user links.
- Recognized SprintOps task keys in branches, commits, and pull requests.
- Inferred links carry confidence and provenance and remain reviewable.

**Phase result:** a sprint item shows its linked branch, commits, pull request, review state, and CI status.

## Phase 6 — Knowledge and Indexing Pipeline

### Fast sequence

1. Add knowledge-document contracts.
2. Add knowledge-document/indexing tables.
3. Add one formatter per source type, one prompt at a time.
4. Add content hashing/version tests.
5. Add OpenRouter embedding configuration.
6. Add query embedding adapter and test.
7. Add batch document embedding and validation.
8. Add Pinecone configuration/client adapter.
9. Add stable vector-ID and metadata builder.
10. Add workspace-scoped upsert job.
11. Add deletion job.
12. Add reconciliation command.
13. Add semantic-search API contract and route.
14. Add semantic-search UI.
15. Run retrieval smoke tests and the phase-wide verification gate.

### 6.1 Canonical knowledge documents

- Format work-item descriptions, acceptance criteria, check-ins, decisions, repository summaries, sprint briefings, and retrospectives.
- Version each document using content hashes.
- Record indexing status in PostgreSQL.

### 6.2 OpenRouter embeddings

- Add a LangChain-compatible OpenRouter embedding adapter.
- Configure model and dimensions through environment variables.
- Batch inputs within provider limits.
- Reject malformed vectors and dimension mismatches.

### 6.3 Pinecone indexing

- One namespace per workspace.
- Stable IDs and metadata filters.
- Idempotent upsert and deletion jobs.
- Rebuild and reconciliation command.
- Bounded handling for eventual consistency.

**Phase result:** authorized semantic search returns relevant SprintOps knowledge with canonical source links.

## Phase 7 — Sprint Risk Agent

### Fast sequence

1. Add structured finding/source schemas.
2. Add agent-run/job tables.
3. Add active-sprint state tool.
4. Add work-item/scope-change tool.
5. Add repository-activity tool.
6. Add Pinecone retriever tool.
7. Add canonical-source resolver.
8. Add LangGraph state and authorize node.
9. Add exact-data retrieval nodes.
10. Add semantic retrieval node.
11. Add evidence grading and bounded rewrite node.
12. Add structured generation node.
13. Add deterministic source validator.
14. Add persistence and failure handling.
15. Add agent-run API endpoint.
16. Add report/progress/source UI.
17. Add approval-request UI without automatic mutation.
18. Add a small evaluation fixture set.
19. Run groundedness/schema evaluations and the phase-wide gate.

### 7.1 Deterministic tools

- Load active sprint state.
- Query work items and scope changes.
- Query linked repository activity.
- Retrieve sprint knowledge from Pinecone.
- Resolve canonical source records.

### 7.2 LangGraph workflow

- Authorize run.
- Load sprint state.
- Plan retrieval.
- Retrieve exact and semantic evidence.
- Grade evidence.
- Rewrite weak queries within a fixed attempt limit.
- Generate structured findings.
- Validate sources and persist report.

### 7.3 Output and approval

- Progress, risks, blockers, next actions, missing information, and sources.
- Confidence and severity.
- Human feedback.
- Approval request for proposed task mutations.
- No automatic mutation.

### 7.4 Tracing and evaluation

- Store graph, prompt, model, and retriever versions.
- Trace node/tool execution without leaking sensitive content.
- Build an evaluation dataset from curated and corrected reports.
- Score schema validity, source coverage, retrieval relevance, groundedness, and accepted-risk rate.

**Phase result:** generate a cited sprint report and inspect the evidence behind every finding.

## Phase 8 — Sprint Review and Retrospective

### Fast sequence

1. Add sprint-outcome comparison query.
2. Add completed/rolled-over/blocked/removed summary contract.
3. Add relevant-decision/history retrieval.
4. Add retrospective prompt/output schema.
5. Add bounded retrospective generation workflow.
6. Add accept/edit/reject persistence.
7. Add approved-retrospective indexing job.
8. Add sprint review UI.
9. Add retrospective editor UI.
10. Add no-ranking/no-judgment tests.
11. Run the phase-wide verification gate and update context.

- Close sprint with baseline-versus-outcome comparison.
- Summarize completed, rolled-over, blocked, and removed scope.
- Retrieve related decisions and prior patterns.
- Generate retrospective prompts rather than judging individual performance.
- Let the team accept, edit, or reject the generated narrative.
- Index approved retrospective outcomes for future retrieval.

**Phase result:** close a sprint and produce a review grounded in its actual work history.

## Phase 9 — Production Readiness

### Fast sequence

1. Add CI lint job.
2. Add CI typecheck job.
3. Add CI unit-test job.
4. Add CI build/migration job.
5. Add Electron packaging configuration.
6. Add signing configuration validation.
7. Add notarization release step.
8. Add update-channel configuration.
9. Add API deployment configuration.
10. Add worker deployment configuration.
11. Add queue lease recovery.
12. Add dead-letter handling.
13. Add workspace rate limits.
14. Add model cost budgets.
15. Add export workflow.
16. Add deletion/offboarding workflow.
17. Add backup/restore verification.
18. Run IPC/OAuth/webhook/RLS/agent security checks.
19. Run accessibility and performance checks.
20. Run the release verification gate and update context.

- Electron packaging, signing, and update strategy.
- Hosted API/worker deployment.
- Queue recovery and dead-letter handling.
- Rate limits and cost budgets per workspace.
- Security review for IPC, OAuth, webhooks, RLS, and agent tools.
- Backup, deletion, export, and Pinecone offboarding workflows.
- Accessibility and performance verification.
- CI for lint, typecheck, tests, builds, and migrations.

## Explicit Non-Goals During Initial Build

- Custom workflow builders.
- Jira/Linear synchronization.
- Source-code embeddings.
- Autonomous task mutation.
- Developer rankings or performance scoring.
- Broad multi-agent systems.
- Mobile application.
- Offline-first conflict resolution.

## Implementation Gate

Do not begin the next phase until the current phase-wide verification gate passes. Keep each Codex request limited to one numbered micro-step unless two adjacent steps edit exactly the same files.
