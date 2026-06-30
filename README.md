# SprintOps AI

SprintOps is a desktop-native sprint copilot that connects developers' local Git work to individual and team sprint commitments.

The repository is in a staged migration from a JavaScript Electron prototype to a TypeScript workspace. Phases 0–2 establish the secure desktop, hosted API, PostgreSQL tenancy model, workspaces, memberships, invitations, and projects.

## Requirements

- Node.js 20.19+ or 22.12+
- npm 10+
- A Supabase project for authentication

## Setup

```bash
npm install
cp .env.example .env
```

Configure `.env`:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
SPRINTOPS_API_BASE_URL=http://127.0.0.1:3000
SUPABASE_AUTH_CALLBACK_PORT=39177
DATABASE_URL=postgresql://...
SPRINTOPS_INVITATION_BASE_URL=http://127.0.0.1:3000
```

`SUPABASE_ANON_KEY` remains supported during migration, but new configuration should use `SUPABASE_PUBLISHABLE_KEY`.

Add the desktop OAuth callback to Supabase Authentication URL Configuration:

```text
http://127.0.0.1:39177/auth/callback
```

Google and GitHub provider applications continue to use Supabase's provider callback URL:

```text
https://your-project-ref.supabase.co/auth/v1/callback
```

## Run

Apply database migrations once:

```bash
npm run db:migrate
```

Start the API and desktop in separate terminals:

```bash
npm run dev:api
npm run dev
```

Organization invitation links are shared manually. Recipients sign in, open **Workspaces**, paste the link into **Workspace invitation**, and accept it.

Build and preview the production Electron bundles:

```bash
npm run build
npm start
```

## Verify

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Workspace

```text
apps/desktop/       Electron main, preload, and React renderer
apps/api/           Authenticated workspace and project API
packages/contracts/ Shared Zod contracts and cross-process types
packages/domain/    Workspace authorization and lifecycle rules
packages/db/        Drizzle schema, migration, and PostgreSQL adapter
server/             Legacy prototype server; retained during migration
src/                Legacy Electron/renderer prototype; no longer active
react/              Legacy unintegrated Vite starter; no longer active
context/            Local authoritative product and architecture guidance
```

The active desktop entry point is `apps/desktop`. Do not add features to the legacy renderer.

## Security Model

- Renderer sandboxing and context isolation stay enabled.
- Node integration stays disabled.
- Preload exposes only typed, allowlisted methods.
- Supabase sessions are persisted with Electron `safeStorage` encryption.
- Refresh tokens never cross the preload seam.
- The hosted API client requests a current access token for each request.
- OAuth scopes are identity-only; repository access will use a GitHub App in Phase 5.
- Every tenant operation validates workspace membership and role server-side.
- PostgreSQL RLS provides defense in depth for all Phase 2 tenant tables.
- Invitation links contain single-use tokens; PostgreSQL stores only SHA-256 hashes.

## Data Boundary

SprintOps may later synchronize repository identity, branch names, commit metadata/messages, pull-request metadata, reviews, CI state, and explicit task links. It must never upload source files, diffs, patches, secrets, environment values, or terminal history.

## Current Limitations

- Backlog and sprint persistence begin in Phase 3.
- Local repository selection begins in Phase 4.
- The API runs locally for development; hosted deployment remains production-readiness work.
- Packaging/signing and automatic updates are production-readiness work.
