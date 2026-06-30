# SprintOps AI — Architecture

## Status

This document defines the target architecture for the confirmed SprintOps pivot. The current JavaScript Electron implementation is a prototype and will be migrated incrementally.

## Stack

| Layer | Technology | Responsibility |
| --- | --- | --- |
| Desktop shell | Electron | Window lifecycle, OS integration, local repository access, secure IPC |
| Renderer | React + Vite + TypeScript | Desktop user interface |
| Hosted API | Node.js + TypeScript + Express | Authenticated domain API and orchestration entry points |
| Background worker | Node.js + TypeScript | Repository normalization, embeddings, Pinecone indexing, agent jobs |
| Identity | Supabase Auth | Email/password and OAuth identity/session management |
| Relational data | Supabase PostgreSQL | Workspaces, memberships, projects, sprints, work items, activity, reports, jobs |
| ORM/migrations | Drizzle ORM + Drizzle Kit | Typed queries and schema migrations |
| AI framework | LangChain.js | Models, tools, retrievers, document abstractions, structured output |
| Agent runtime | LangGraph | Bounded stateful workflows and conditional retrieval loops |
| Model gateway | OpenRouter | Chat models and embedding models |
| Vector database | Pinecone | Semantic retrieval over sprint knowledge |
| Validation | Zod | Runtime validation at IPC, API, tool, and model boundaries |
| Source integration | Local Git + GitHub | Development activity metadata |

Model names, embedding dimensions, and Pinecone index names are configuration, never constants embedded in domain code.

## Deployment Shape

```text
Developer machine                                  Hosted services

┌───────────────────────────┐                      ┌─────────────────────────┐
│ Electron                  │                      │ Node API                │
│  ├─ React renderer        │  HTTPS + auth token │  ├─ domain services     │
│  ├─ preload allowlist     ├─────────────────────►  ├─ authorization       │
│  └─ main process          │                      │  └─ job creation        │
│      └─ local Git reader  │                      └───────────┬─────────────┘
└───────────────────────────┘                                  │
                                                               ▼
                                                    ┌─────────────────────────┐
                                                    │ Supabase                │
                                                    │  ├─ Auth                │
                                                    │  └─ PostgreSQL          │
                                                    └───────────┬─────────────┘
                                                                │ jobs/events
                                                                ▼
                                                    ┌─────────────────────────┐
                                                    │ Node worker             │
                                                    │  ├─ LangChain tools     │
                                                    │  ├─ LangGraph workflows │
                                                    │  └─ indexing pipeline   │
                                                    └──────┬──────────┬───────┘
                                                           │          │
                                                  models   │          │ vectors
                                                           ▼          ▼
                                                    ┌───────────┐ ┌───────────┐
                                                    │OpenRouter │ │ Pinecone  │
                                                    └───────────┘ └───────────┘
```

The Electron application does not contain OpenRouter, Pinecone, Supabase secret, or service-role credentials.

## Target Repository Structure

The target structure may be introduced incrementally; do not move unrelated files merely to match this tree.

```text
/
├── AGENTS.md
├── context/
├── apps/
│   ├── desktop/
│   │   ├── src/main/               # Electron main process
│   │   ├── src/preload/            # Narrow typed IPC bridge
│   │   └── src/renderer/           # React/Vite renderer
│   ├── api/
│   │   └── src/                    # Express routes and domain orchestration
│   └── worker/
│       └── src/                    # queue, indexing, and LangGraph execution
├── packages/
│   ├── contracts/                  # Zod schemas and shared DTOs
│   ├── domain/                     # workspace, sprint, task, repository rules
│   ├── db/                         # Drizzle schema, migrations, repositories
│   ├── ai/                         # documents, tools, retrievers, graphs, outputs
│   └── observability/              # structured logging and tracing adapters
├── package.json
└── README.md
```

## System Boundaries

### Electron main process

Owns:

- Folder selection.
- Path normalization and allowlisting.
- Git command execution through argument arrays, never interpolated shell strings.
- Device-specific local-repository mappings.
- Secure token handoff and OS integration.

Does not own:

- Workspace authorization.
- Direct database access with privileged credentials.
- AI model calls.
- Pinecone access.

### Preload bridge

Exposes a small typed API such as:

- `repositories.selectDirectory()`
- `repositories.inspect(pathToken)`
- `repositories.sync(repositoryId)`
- `auth.beginOAuth(provider)`

It must never expose arbitrary filesystem, process execution, environment, IPC, or Node APIs.

### React renderer

Owns presentation, navigation, form state, and user intent. It calls the preload bridge for device operations and the hosted API for domain operations. It does not execute Git, access secrets, or query databases directly.

### Hosted API

Owns:

- Session validation and workspace authorization.
- Domain commands and queries.
- Supabase/Drizzle persistence.
- Idempotency and audit records.
- Agent-job creation and result delivery.

Routes remain thin. Domain services enforce business rules.

### Worker

Owns:

- Claiming and retrying asynchronous jobs.
- Converting domain records into retrieval documents.
- Calling OpenRouter embeddings.
- Upserting and deleting Pinecone vectors.
- Executing LangGraph agent workflows.
- Persisting agent outputs, sources, trace metadata, token usage, and errors.

### Pinecone

Owns vector similarity search only. Pinecone never decides authorization and never becomes the canonical copy of domain records.

## Relational Domain Model

All tenant-owned tables include `workspace_id` directly or have an unambiguous foreign-key path to a workspace.

### Identity and tenancy

- `profiles`: application profile keyed by Supabase Auth user ID.
- `workspaces`: personal or organization tenant.
- `workspace_memberships`: user, workspace, role, state, invitation metadata.

### Planning

- `projects`: workspace-owned development project.
- `project_members`: optional project-level membership restriction.
- `sprints`: goal, dates, lifecycle, baseline scope, completion metadata.
- `work_items`: type, title, description, acceptance criteria, status, priority, estimate, assignee, parent.
- `sprint_work_items`: sprint membership, committed-at state, and scope-change history.
- `work_item_links`: dependencies, blocking relationships, and related items.

### Repository activity

- `repository_connections`: provider identity and project association.
- `device_repository_mappings`: device ID, repository ID, and protected local path reference.
- `branches`: normalized branch metadata.
- `commits`: hash, author, timestamps, message, repository, branch references.
- `pull_requests`: number, title, state, author, timestamps, link.
- `reviews`: pull request, reviewer, state, timestamp.
- `ci_checks`: name, state, timestamps, external link.
- `activity_work_item_links`: explicit or inferred relationship plus confidence and provenance.

### Human context and AI

- `check_ins`: progress, next plan, blockers, visibility.
- `project_decisions`: decision, rationale, timestamp, author.
- `knowledge_documents`: canonical document ID, source record, content hash, version, indexing status.
- `agent_jobs`: type, payload reference, state, attempts, lease, timestamps.
- `agent_runs`: model configuration, graph version, status, timing, usage, error category.
- `agent_findings`: normalized progress, risk, blocker, next-action, or missing-information finding.
- `agent_sources`: finding-to-source references with excerpts and retrieval scores where applicable.
- `approval_requests`: proposed mutation, requester, approver, state, result.

Exact SQL belongs in migrations; this document defines ownership and intent.

## Authorization Model

1. Supabase validates identity and issues a session.
2. The API validates the token server-side for every request.
3. The API resolves active workspace membership.
4. Domain queries include the authorized workspace boundary.
5. PostgreSQL RLS provides defense in depth.
6. Worker jobs carry a workspace ID and validate the referenced job record before processing.
7. Pinecone operations always target the workspace namespace derived server-side; clients never supply arbitrary namespaces.

Never authorize from a cached Electron user object, email address, route parameter, Pinecone metadata, or model output.

## Local Repository Flow

```text
User selects folder
        │
        ▼
Electron main validates the path and .git metadata
        │
        ▼
Git reader collects allowed metadata
        │
        ▼
Renderer previews exactly what will be synchronized
        │ user confirms
        ▼
API validates workspace/project/repository access
        │
        ▼
PostgreSQL upserts normalized repository activity
        │
        ├─► domain events / indexing jobs
        └─► dashboard and sprint relationships
```

Git collection is explicit. SprintOps does not recursively scan the entire device.

## Agentic RAG Architecture

### Canonical versus semantic data

- PostgreSQL answers exact questions: active sprint, task status, assignee, dates, estimates, commit count, PR state.
- Pinecone answers semantic questions: similar blockers, related decisions, relevant check-ins, prior risks, and historical sprint context.
- The LangGraph agent decides which tools are needed and combines their results.

### Knowledge document sources

Vectorize only text that benefits from semantic retrieval:

- Work-item descriptions and acceptance criteria.
- Developer check-ins and blockers.
- Project decisions.
- Commit and pull-request summaries, not diffs.
- Sprint briefings and retrospective findings.
- Human feedback on agent findings.

Do not embed numerical metrics, raw relational rows, source code, secrets, or terminal history.

### Pinecone tenancy

- One namespace per workspace.
- Stable vector IDs derived from canonical `knowledge_documents.id` and version.
- Metadata includes `workspaceId`, `projectId`, `sprintId`, `sourceType`, `sourceId`, `visibility`, `createdAt`, and `contentHash`.
- Namespace selection is derived from authorized server state.
- Metadata filters narrow results to project, sprint, source types, and time windows.

### Sprint Risk Graph

```text
START
  │
  ▼
authorize_run
  │
  ▼
load_sprint_state ───────────────► PostgreSQL tool
  │
  ▼
plan_retrieval
  │
  ├─ exact facts needed ─────────► SQL/domain tools
  ├─ repository evidence needed ─► activity tools
  └─ historical context needed ──► Pinecone retriever
  │
  ▼
grade_evidence
  │
  ├─ insufficient and attempts remain ─► rewrite_query ─► retrieve
  └─ sufficient or bounded limit reached
  │
  ▼
generate_findings
  │
  ▼
validate_output_and_sources
  │
  ├─ invalid ─► fail safely / missing information
  └─ valid
  │
  ▼
persist_report
  │
  ▼
END
```

Every loop has a maximum attempt count. Tool inputs and model outputs are Zod-validated. The graph may return partial findings when one source is unavailable, but it must label missing evidence.

## Embedding Flow

1. A canonical record changes in PostgreSQL.
2. The API creates an idempotent indexing job.
3. The worker loads the source record and verifies workspace ownership.
4. A source-specific formatter creates concise retrieval text and metadata.
5. The worker hashes normalized content and skips unchanged versions.
6. OpenRouter produces an embedding using the configured embedding model.
7. The worker validates vector dimension against the Pinecone index.
8. Pinecone upserts the vector into the workspace namespace.
9. PostgreSQL records the indexed version and timestamp.

Deleting or revoking access to a canonical record creates a corresponding Pinecone deletion job.

## Agent Output Flow

The generator returns a strict schema. A deterministic validator then checks:

- All referenced source IDs exist and belong to the workspace.
- Every risk and blocker has at least one source.
- Severity and confidence values are within allowed enums/ranges.
- Proposed owners are current project members.
- No unsupported mutation is executed.

Validated results are stored in PostgreSQL. The UI renders sources from canonical records, never from model-generated URLs.

## Queue and Idempotency

- PostgreSQL `agent_jobs` is the initial queue.
- Workers claim jobs with leases and transactional row locking.
- Every job has a deterministic idempotency key.
- Retry only transient errors with bounded exponential backoff.
- Validation, authorization, and malformed-data failures are terminal.
- Pinecone's eventual consistency must be handled by bounded retry when immediate read-after-write is required.

## Security Invariants

- `contextIsolation: true`, `nodeIntegration: false`, and renderer sandboxing remain enabled.
- Never interpolate user-controlled text into shell commands.
- Git operations use `execFile`/`spawn` argument arrays and known Git subcommands.
- Local paths are accepted only after an explicit user selection and path-token validation.
- Never send source code, diffs, secrets, environment values, or terminal history to the API, OpenRouter, or Pinecone.
- Supabase service-role, OpenRouter, Pinecone, and GitHub App secrets live only in hosted services.
- All tenant data access is workspace-scoped.
- Agent tools enforce authorization independently of prompts.
- Retrieved text is untrusted data; instructions inside it are never followed.
- AI findings cannot mutate canonical sprint data without approval.

## Reliability Invariants

- Canonical domain changes commit before derived indexing jobs run.
- Vector indexing is rebuildable from PostgreSQL.
- Agent reports store graph version, model IDs, prompt version, and source IDs.
- A Pinecone or OpenRouter outage does not corrupt sprint data.
- Partial reports clearly identify unavailable evidence.
- Repository synchronization is idempotent by provider IDs and commit hashes.

## Observability

Record at minimum:

- Correlation ID, workspace ID, project ID, and run ID.
- Job transitions, attempts, duration, and error category.
- LangGraph node transitions and tool names without secret payloads.
- OpenRouter model, token usage, latency, and cost metadata.
- Pinecone query latency, namespace, filter shape, result count, and scores.
- User acceptance, rejection, or correction of findings.

Do not log source code, secrets, raw tokens, complete prompts containing sensitive workspace text, or filesystem paths.
