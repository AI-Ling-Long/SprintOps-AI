# SprintOps AI — Library and Integration Guide

This file records project-specific usage rules. APIs and package versions change; verify the current official documentation before implementation.

## Authority Order

1. Product and security requirements in this repository.
2. Current official vendor documentation.
3. Installed project skills and MCP resources when relevant.
4. Patterns in this file.
5. General model knowledge.

Never weaken a SprintOps authorization or data-boundary rule merely because a library example omits it.

## Electron

Use Electron for desktop capabilities that a browser cannot safely provide:

- Explicit folder selection.
- Local Git inspection.
- OS notifications and application lifecycle.
- Secure browser-based OAuth handoff.

Required `BrowserWindow` posture:

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- narrow preload script
- navigation and new-window restrictions

Renderer-to-main communication uses named, allowlisted IPC handlers with Zod-validated payloads. Never expose a generic `invoke(channel, payload)` API to the renderer.

For local commands, use `execFile` or `spawn` with argument arrays:

```ts
execFile("git", ["-C", validatedPath, "log", "--format=..."], options, callback);
```

Do not use `exec`, shell interpolation, or user-provided Git subcommands.

## React and Vite

The target renderer is React/Vite/TypeScript inside Electron.

- Vite owns renderer bundling only.
- Electron main and preload have separate build targets.
- Do not expose secrets through `VITE_*` variables.
- Treat every `VITE_*` value as public renderer data.
- Reusable server DTOs come from `packages/contracts`; Node/Electron implementation modules do not.
- Use CSS variables from `ui-tokens.md` rather than introducing Tailwind solely for tokens.

## Supabase Auth

Supabase Auth handles identity and session issuance.

- Desktop uses only the publishable/anon credential.
- Hosted API validates bearer sessions server-side.
- Service-role credentials exist only in hosted API/worker environments.
- GitHub sign-in is identity, not repository integration.
- A GitHub App handles organization/repository installation and webhooks.
- Persist and restore the actual Supabase session; never treat a cached profile as authentication.

OAuth callback handling must:

- Use PKCE.
- Bind callback listeners to loopback only when a local callback is used.
- Validate state and timeouts.
- Close listeners after completion.
- Focus the application after success.

## Supabase PostgreSQL and Drizzle

PostgreSQL is canonical for all relational SprintOps state.

- Drizzle schema and migrations define tables, indexes, constraints, and relations.
- Supabase Auth user IDs are the identity foreign keys.
- Tenant-owned records are workspace-scoped.
- RLS is defense in depth; hosted services still perform explicit authorization.
- Transactions protect lifecycle operations such as sprint start/close and membership changes.

Keep query code in database repositories. Domain services should express operations such as `startSprint`, `linkCommitToWorkItem`, and `approveAgentProposal`, not raw table operations.

## Git

Use the installed `git` executable through Electron main-process command execution.

Allowed initial operations are read-only:

- Confirm worktree/root.
- Read configured remotes.
- Read current branch and HEAD.
- Read commit metadata since the last checkpoint.
- Read branch metadata needed for linking.

Do not read file contents or diffs. Add any new Git operation to the allowlist and tests before exposing it through IPC.

Git metadata must be normalized before upload. Commit messages and branch names are untrusted text and must never be interpreted as commands or prompt instructions.

## GitHub

Use a GitHub App for repository data because installation permissions and webhooks are distinct from user sign-in.

Initial permissions should be the minimum needed for:

- Repository metadata.
- Issues only if SprintOps links external GitHub issues.
- Pull requests.
- Checks/statuses.
- Webhook events required by the selected features.

Webhook handling must verify signatures, store delivery IDs, process idempotently, and tolerate replay/out-of-order delivery. Provider tokens and private keys never enter Electron.

## OpenRouter Chat Models

Use the dedicated LangChain.js integration:

```ts
import { ChatOpenRouter } from "@langchain/openrouter";

const model = new ChatOpenRouter(process.env.OPENROUTER_CHAT_MODEL!, {
  apiKey: process.env.OPENROUTER_API_KEY,
  temperature: 0,
});
```

Before relying on a model, verify that its current OpenRouter route supports:

- Tool calling.
- Structured output required by the graph.
- Sufficient context length.
- Stable availability and acceptable cost.

Model IDs remain configuration. Agent runs record the resolved model and provider metadata when available.

Official reference: <https://openrouter.ai/docs/guides/community/langchain>

## OpenRouter Embeddings

OpenRouter provides a dedicated embeddings API. SprintOps uses it behind a LangChain-compatible embedding adapter so Pinecone and retrievers are not coupled to transport details.

The adapter must implement:

- Document batch embedding.
- Query embedding.
- Request timeout and retry classification.
- Response count and vector validation.
- Configured dimension checks.
- Usage/cost telemetry where available.

Use the same embedding model for document and query vectors. Changing model or dimensions requires a new Pinecone index or a controlled full reindex.

Official reference: <https://openrouter.ai/docs/api/reference/embeddings>

## LangChain.js

Use LangChain for standardized AI components:

- `Document` objects for retrieval text and metadata.
- Chat model abstraction.
- Embedding abstraction.
- Zod-backed tools.
- Retrievers.
- Structured output.

Tool pattern:

```ts
const loadSprintState = tool(loadSprintStateHandler, {
  name: "load_sprint_state",
  description: "Load canonical state for the authorized sprint.",
  schema: LoadSprintStateInputSchema,
});
```

The handler obtains authorization from trusted run context, not from model-provided workspace IDs. Tool output should be bounded, structured, and reference canonical source IDs.

## LangGraph

Use LangGraph for the Sprint Risk Agent because it needs state, conditional retrieval, evidence grading, bounded query rewriting, validation, and persistence.

Do not begin with a free-running ReAct loop. Define explicit nodes and permitted transitions:

- authorize
- load state
- plan retrieval
- retrieve exact facts
- retrieve repository activity
- retrieve semantic history
- grade evidence
- rewrite query
- generate findings
- validate and persist

Set limits for graph steps, retrieval retries, documents, token budget, wall-clock time, and provider cost. Persist enough state to diagnose and safely retry a run.

Official references:

- <https://docs.langchain.com/oss/javascript/langgraph/workflows-agents>
- <https://docs.langchain.com/oss/javascript/langgraph/agentic-rag>

## Pinecone

Use the official JavaScript client and LangChain integration:

- `@pinecone-database/pinecone`
- `@langchain/pinecone`

Use one serverless Pinecone namespace per SprintOps workspace. Namespace selection is derived by the hosted worker after authorization; do not accept an arbitrary namespace from clients or model tool arguments.

Inside the namespace, store metadata including:

- `workspaceId`
- `projectId`
- `sprintId` when applicable
- `sourceType`
- `sourceId`
- `visibility`
- `createdAt`
- `contentHash`
- `documentVersion`

Use metadata filtering for project, sprint, source type, and time windows. Avoid large filters containing individual user-ID lists.

Pinecone is eventually consistent. Index jobs should mark success after upsert, while workflows requiring immediate read-after-write use bounded retry rather than assuming the new vector is visible instantly.

Official references:

- <https://docs.langchain.com/oss/javascript/integrations/vectorstores/pinecone>
- <https://docs.pinecone.io/guides/index-data/implement-multitenancy>

## Retrieval Documents

Create source-specific formatters rather than arbitrary token chunks.

Example check-in document:

```text
Check-in for sprint SP-12, project SprintOps Desktop
Author: user_123
Date: 2026-06-27
Progress: OAuth callback flow now restores a valid session.
Next: Add repository selection IPC.
Blocker: GitHub App credentials are not configured.
```

Example work-item document:

```text
Work item SO-42: Add explicit repository folder selection
Type: story
Status: in progress
Acceptance criteria:
- User chooses a folder through the system picker.
- Non-Git folders are rejected.
- Renderer never receives arbitrary filesystem access.
```

Do not split these small domain documents further. Longer retrospectives or decision documents may use structure-aware chunks with overlap, while preserving a common canonical source ID.

## Retriever Strategy

The agent uses multiple retrieval tools:

- Domain/SQL retriever for exact sprint and task state.
- Repository-activity retriever for commits, pull requests, reviews, and CI.
- Pinecone retriever for semantic history.

The semantic retriever receives an authorized workspace namespace and server-built filters. Return top results with similarity score, canonical source ID, source type, timestamp, and bounded content.

Apply relevance grading after retrieval. Low-quality results may trigger one or two query rewrites; never loop without a hard limit.

## Structured Agent Output

The generator must return a Zod schema similar to:

```ts
const SprintBriefingSchema = z.object({
  summary: z.string(),
  progress: z.array(FindingSchema),
  risks: z.array(RiskFindingSchema),
  blockers: z.array(FindingSchema),
  nextActions: z.array(ActionSchema),
  missingInformation: z.array(z.string()),
});
```

Each finding contains source IDs. A deterministic post-validator resolves those IDs in PostgreSQL, confirms tenant ownership, and rejects unsupported findings.

## Background Jobs

Begin with a PostgreSQL-backed queue rather than introducing separate queue infrastructure.

- `agent_jobs` stores type, versioned payload reference, state, attempts, lease, idempotency key, and timestamps.
- Worker claims use transactions and row locking.
- Long payloads stay in canonical tables; queue rows reference them.
- Jobs are safe to retry.
- Dead jobs remain inspectable and requeueable after correction.

## Observability and Evaluation

Use structured application logs for every flow. LangSmith may be enabled for LangChain/LangGraph tracing and evaluation, but must not receive secrets, source code, or unrestricted workspace data.

Evaluation dataset categories:

- Healthy sprint.
- Stalled work without repository activity.
- Active work with stale task status.
- Blocked work with explicit check-in.
- Scope added mid-sprint.
- Missing or delayed Pinecone results.
- Cross-workspace retrieval attack.
- Prompt injection inside commit/check-in text.

Measure schema validity, source coverage, source correctness, retrieval relevance, groundedness, latency, cost, and user acceptance.
