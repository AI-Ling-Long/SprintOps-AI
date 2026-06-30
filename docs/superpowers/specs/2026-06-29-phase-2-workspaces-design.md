# Phase 2 Workspaces Design

## Scope

Phase 2 adds personal and organization workspaces, membership roles, copyable expiring invitations, projects, audit records, authenticated API operations, and desktop workspace/project management.

## Architecture

- `packages/contracts` owns Zod request/response contracts.
- `packages/domain` owns tenancy rules behind a `WorkspaceService` interface and has no framework dependency.
- `packages/db` owns the Drizzle schema, PostgreSQL adapter, migration, indexes, constraints, and RLS.
- `apps/api` validates Supabase bearer sessions, derives the actor from the token, and invokes domain operations through an authorized repository adapter.
- `apps/desktop` uses its existing authenticated API client. It never queries Supabase PostgreSQL directly.

## Invariants

- Every user has exactly one personal workspace and an owner membership.
- Organization roles are `owner`, `admin`, and `member`.
- Owners/admins can invite and manage members; only owners can grant/revoke owner.
- A workspace must retain at least one active owner.
- Invitations are single-use, expire after seven days, and store only a SHA-256 token hash.
- Invitation acceptance requires the signed-in email to match the invitation email.
- Projects belong to one workspace; personal projects are visible only to their owner membership.
- Every tenant query is scoped by both actor membership and workspace ID.

## UI

The application shell loads the actor's workspaces, selects the personal workspace initially, and provides explicit workspace switching. The Workspaces view creates organizations and manages invitations/members. The Projects view lists and creates projects in the selected workspace. Loading, empty, error, permission, and mutation-pending states are visible and keyboard accessible.

## Verification

Domain tests cover personal provisioning, role permissions, owner preservation, invitation lifecycle, and cross-workspace denial. API tests cover bearer authentication and structured envelopes. Renderer tests cover workspace switching, organization creation, invitation copying, and project creation. Schema checks cover tenant keys, indexes, and RLS migration content.
