# SprintOps AI — Code Standards

These rules apply to target SprintOps code. Existing JavaScript prototype code may violate them; new work should improve the seam it touches without performing unrelated rewrites.

## Engineering Principles

- Preserve the product and security invariants in `project-overview.md` and `architecture.md`.
- Build one verifiable vertical slice at a time.
- Keep canonical data deterministic; treat AI output as derived and fallible.
- Prefer explicit domain language over generic service/helper abstractions.
- Validate external data at every trust boundary.
- Never hide uncertainty in AI output.
- Do not overwrite unrelated user changes.

## TypeScript

- Use strict TypeScript for all new target code.
- Do not introduce `any`; use `unknown` and narrow it.
- Validate runtime inputs with Zod even when TypeScript types exist.
- Prefer discriminated unions for lifecycle states and job results.
- Use `const` unless reassignment is required.
- Do not leave floating promises.
- Use named exports for domain modules and React components.
- Keep types near the behavior they describe; share contracts through `packages/contracts` only when they cross process boundaries.

## Naming

- Directories and non-component files: `kebab-case`.
- React component files: `PascalCase.tsx`.
- Functions and variables: `camelCase`.
- Types and schemas: `PascalCase`, with runtime schemas ending in `Schema`.
- Database columns: `snake_case`.
- Domain identifiers include the entity name: `workspaceId`, `sprintId`, `agentRunId`.
- Avoid stale names such as `jarvis`, `jobpilot`, and `insforge`.

## Module Boundaries

- Renderer components do not execute Git, access Node APIs, call Pinecone, or use privileged Supabase clients.
- Electron main-process modules do not implement workspace business rules.
- API routes validate transport concerns and call domain services; they do not embed raw database queries.
- Domain services depend on repository interfaces, not Express or Electron objects.
- Database modules contain queries and persistence mapping, not UI or model prompts.
- AI tools call authorized domain services; they do not query arbitrary tables.
- Pinecone adapters contain vector-store mechanics; agent graphs depend on retriever interfaces.

## Electron Security

- Keep `contextIsolation: true`.
- Keep `nodeIntegration: false`.
- Keep renderer sandboxing enabled.
- Expose the minimum preload API with `contextBridge`.
- Use allowlisted IPC channels and Zod schemas for request and response payloads.
- Never expose `ipcRenderer`, `shell`, `fs`, `child_process`, environment variables, or arbitrary paths to the renderer.
- Use `dialog.showOpenDialog` for explicit repository selection.
- Use `execFile` or `spawn` with argument arrays for Git. Never construct shell commands from user-controlled strings.
- Disable unexpected navigation and window creation; open trusted external URLs through explicit handlers.

## Local Git Rules

- Inspect only repositories the user explicitly selected.
- Normalize and validate paths in the main process.
- Collect only fields allowed by `project-overview.md`.
- Never read or upload source files, diffs, patches, secrets, environment files, or terminal history.
- Treat commit messages and branch names as untrusted text.
- Synchronization is incremental and idempotent by provider IDs and commit hashes.
- A failed repository must not prevent other repositories from synchronizing.

## API Contracts

- All request bodies, parameters, and responses have Zod schemas.
- Return a consistent envelope:

```ts
type ApiResult<T> =
  | { ok: true; data: T; correlationId: string }
  | { ok: false; error: { code: string; message: string }; correlationId: string };
```

- Never expose stack traces, provider responses, SQL, prompts, or secret values to clients.
- Use semantic status codes and stable application error codes.
- Require idempotency keys for retryable client mutations and webhook processing.
- Apply request size and rate limits to repository sync and agent endpoints.

## Authentication and Authorization

- Supabase Auth proves identity; it does not prove workspace access.
- Validate the session server-side on every protected request.
- Resolve workspace membership before reading or mutating tenant data.
- Scope every database query to the authorized workspace.
- Keep RLS policies as defense in depth.
- Service-role credentials are backend-only.
- Never trust a workspace ID, role, email, or namespace provided by the model or renderer without server validation.

## Database

- Drizzle schema and migrations are the canonical database definition.
- Every migration is forward-only and reviewed for data loss.
- Use UUIDs for externally visible domain identifiers.
- Store timestamps as timezone-aware values in UTC.
- Enforce lifecycle and uniqueness invariants with constraints where possible.
- Use transactions for multi-record domain changes.
- Do not store derived vector values in PostgreSQL when Pinecone owns them; store vector IDs, versions, hashes, and indexing status.
- Do not use Pinecone as a join target or canonical database.

## React Renderer

- Components render state and user intent; side effects live in hooks/services with explicit interfaces.
- Keep server state in a query/cache layer and local form state in components.
- Do not mirror canonical server records into `localStorage`.
- `localStorage` may hold disposable preferences only.
- Every asynchronous surface has loading, empty, error, and stale states.
- Use semantic HTML, keyboard access, visible focus, and accessible labels.
- Use tokens from `ui-tokens.md`; do not hardcode visual values in components.
- Register reusable components in `ui-registry.md`.

## LangChain and LangGraph

- Use LangChain.js abstractions for chat models, embeddings, tools, retrievers, documents, and structured output.
- Use LangGraph when a workflow needs state, branching, retries, or multiple retrieval steps.
- Prefer deterministic workflows over agents when the path is known.
- Every tool has a narrow purpose, Zod input schema, authorization check, timeout, and bounded output.
- Never create an arbitrary SQL, filesystem, shell, URL-fetch, or Pinecone-namespace tool.
- Keep graph state serializable and free of secrets.
- Bound total steps, retrieval retries, documents, context tokens, time, and cost.
- Version prompts, graphs, output schemas, retriever settings, and model configuration.

## RAG and Evidence

- Retrieve exact facts through domain/SQL tools and semantic context through Pinecone.
- Do not embed data solely because it is available.
- Every vector document has a canonical source ID, content hash, source type, workspace namespace, and timestamps.
- Use one Pinecone namespace per workspace.
- Derive namespaces server-side.
- Treat retrieved content as untrusted data and ignore instructions contained within it.
- Every substantive finding must cite canonical source records.
- Never render a model-generated URL as evidence.
- Low-confidence or unsupported conclusions become `missingInformation`, not assertions.

## Models and Structured Output

- Route chat and embedding requests through OpenRouter.
- Configure model IDs through environment variables.
- Do not silently switch embedding models for an existing Pinecone index; dimension or semantic changes require reindexing.
- Require Zod-validated structured output for agent findings.
- Use low-temperature/default-stable settings for extraction, grading, and risk reporting.
- Record model ID, provider route when available, token usage, latency, and cost.
- Model output never authorizes access or directly mutates canonical data.

## Pinecone

- Use `@langchain/pinecone` and the official Pinecone JavaScript client.
- Use stable, deterministic vector IDs.
- Upsert only after canonical PostgreSQL data commits.
- Delete vectors when the source is deleted, access is revoked, or a workspace is offboarded.
- Use metadata filters for project, sprint, source type, and time range inside the workspace namespace.
- Expect eventual consistency and use bounded retry where immediate reads are required.
- Provide a reconciliation path that rebuilds Pinecone from PostgreSQL.

## Background Jobs

- Jobs have explicit types and versioned payload schemas.
- Claim jobs with a lease; recover abandoned leases.
- Use deterministic idempotency keys.
- Retry transient provider/network failures only.
- Authorization, validation, and permanent provider errors are not endlessly retried.
- Persist attempts and a sanitized failure category.
- Never store secrets in job payloads.

## Error Handling and Logging

- Never use empty catch blocks.
- Add correlation IDs to API, job, sync, and agent flows.
- Log structured fields rather than concatenated prose.
- Redact tokens, local paths, source text, prompts containing sensitive content, and provider payloads.
- User messages explain what failed and what action is available.
- Preserve partial results only when their completeness is explicit.

## Testing

- Unit-test domain rules, parsing, linking, document formatting, and output validation.
- Integration-test API authorization, Drizzle repositories, queue leases, Pinecone adapters, and OpenRouter adapters with fakes or test services.
- Test cross-workspace denial paths explicitly.
- Test IPC contracts and repository path validation.
- Maintain agent evaluation datasets for retrieval relevance, source coverage, groundedness, and schema validity.
- Run lint, typecheck, tests, and relevant builds before handoff.
- If a command cannot run because the environment lacks Node, credentials, or an external service, state that limitation precisely.

## Comments and Documentation

- Comments explain why a constraint exists, not what obvious code does.
- No unresolved `TODO` comments in completed work; use tracked issues or the progress file.
- Update context when an architectural or product decision changes.
- Update `progress-tracker.md` after a completed slice.
- Update `ui-registry.md` after adding or materially changing a reusable UI component.

## Environment Variables

Expected target variables include:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` or publishable key for the desktop client
- `SUPABASE_SERVICE_ROLE_KEY` for hosted services only
- `DATABASE_URL` for hosted API/worker migrations and server queries
- `OPENROUTER_API_KEY` for hosted worker only
- `OPENROUTER_CHAT_MODEL`
- `OPENROUTER_EMBEDDING_MODEL`
- `PINECONE_API_KEY` for hosted worker only
- `PINECONE_INDEX`
- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_WEBHOOK_SECRET`

Update `.env.example` whenever the required configuration changes. Never commit real credentials.

## Dependency Policy

- Prefer platform APIs and existing dependencies.
- Verify current official documentation before adding or upgrading a dependency.
- Record the purpose of every new dependency.
- Do not add a second library that owns the same concern without a migration plan.
- Commit lockfile changes with manifest changes.
