# Phase 2 Workspaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Deliver secure personal/organization workspaces, membership and invitation management, and workspace-owned projects through the hosted API and desktop UI.

**Architecture:** Shared Zod contracts feed a framework-free tenancy module. A Drizzle/PostgreSQL adapter and Supabase-authenticated Express API enforce tenancy server-side; the desktop consumes only the API.

**Tech Stack:** TypeScript, Zod, Drizzle ORM, PostgreSQL/Supabase RLS, Express, React, Vitest.

## Global Constraints

- Never expose service-role/database credentials to Electron.
- Every tenant operation validates actor membership and scopes by workspace.
- Store invitation token hashes, never raw invitation tokens.
- Preserve Electron isolation and the existing authenticated API client seam.

---

### Task 1: Tenancy contracts and domain module

**Files:** Create `packages/domain/**`; modify `packages/contracts/src/index.ts`.

**Produces:** Workspace/project/invitation schemas and `createWorkspaceService(repository, tokenIssuer, clock)`.

- [x] Add a failing domain test for personal provisioning and cross-workspace denial.
- [x] Implement the repository interface, authorization errors, and personal provisioning.
- [x] Add failing tests for organizations, role changes, owner preservation, projects, and invitations.
- [x] Implement the minimum rules to pass each test.
- [x] Run domain and contract tests.

### Task 2: PostgreSQL schema, migration, and adapter

**Files:** Create `packages/db/**` including `drizzle/0001_phase_2_workspaces.sql`.

**Consumes:** Domain repository interface and contract types.

- [x] Add a schema/migration test asserting tenant foreign keys, indexes, and RLS policies.
- [x] Define profiles, workspaces, memberships, invitations, projects, project members, and audit records.
- [x] Implement transactional PostgreSQL repository methods with workspace-scoped predicates.
- [x] Run database package tests and typecheck.

### Task 3: Authenticated hosted API

**Files:** Create `apps/api/**`; modify root scripts and `.env.example`.

**Produces:** `/v1/bootstrap`, workspace, membership, invitation, and project routes using standard envelopes.

- [x] Add a failing API test for missing bearer authentication and workspace-scoped operations.
- [x] Implement Supabase token validation and correlation/error middleware.
- [x] Add thin validated routes backed by `WorkspaceService`.
- [x] Add development startup and verification scripts.
- [x] Run API tests and typecheck.

### Task 4: Desktop workspace and project slice

**Files:** Create workspace/project renderer modules; modify `App.tsx`, `AppShell.tsx`, styles, and UI registry.

- [x] Add a failing renderer test for initial personal workspace load and explicit switching.
- [x] Implement a workspace API module and `WorkspaceSwitcher`.
- [x] Add failing tests for organization/invitation/member and project flows.
- [x] Implement accessible loading, empty, error, permission, and pending states.
- [x] Update the UI registry and run renderer tests.

### Task 5: Phase verification and documentation

**Files:** Modify README and `context/progress-tracker.md`.

- [x] Run lint, typecheck, tests, builds, and migration static verification.
- [x] Review plan alignment, architecture boundaries, UI tokens, and production error states.
- [x] Record external database/Supabase limitations precisely and mark Phase 2 complete only if all local gates pass.
