DO $$ BEGIN CREATE TYPE "workspace_type" AS ENUM ('personal', 'organization'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "workspace_role" AS ENUM ('owner', 'admin', 'member'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "membership_status" AS ENUM ('active', 'suspended'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "invitation_status" AS ENUM ('pending', 'accepted', 'revoked', 'expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "profiles" (
  "user_id" uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  "email" text NOT NULL,
  "display_name" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "workspaces" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL CHECK (char_length("name") BETWEEN 1 AND 100),
  "slug" text NOT NULL,
  "type" workspace_type NOT NULL,
  "personal_owner_id" uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  "created_by" uuid NOT NULL REFERENCES auth.users(id),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "workspaces_personal_owner_shape" CHECK (
    ("type" = 'personal' AND "personal_owner_id" IS NOT NULL) OR
    ("type" = 'organization' AND "personal_owner_id" IS NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS "workspaces_slug_unique" ON "workspaces" ("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "workspaces_personal_owner_unique" ON "workspaces" ("personal_owner_id") WHERE "type" = 'personal';

CREATE TABLE IF NOT EXISTS "workspace_memberships" (
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "role" workspace_role NOT NULL,
  "status" membership_status NOT NULL DEFAULT 'active',
  "joined_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "workspace_memberships_workspace_user_pk" PRIMARY KEY ("workspace_id", "user_id")
);
CREATE INDEX IF NOT EXISTS "workspace_memberships_user_status_idx" ON "workspace_memberships" ("user_id", "status");

CREATE TABLE IF NOT EXISTS "workspace_invitations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "email" text NOT NULL,
  "role" workspace_role NOT NULL CHECK ("role" <> 'owner'),
  "token_hash" text NOT NULL,
  "status" invitation_status NOT NULL DEFAULT 'pending',
  "invited_by" uuid NOT NULL REFERENCES auth.users(id),
  "accepted_by" uuid REFERENCES auth.users(id),
  "expires_at" timestamptz NOT NULL,
  "accepted_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_invitations_token_hash_unique" ON "workspace_invitations" ("token_hash");
CREATE INDEX IF NOT EXISTS "workspace_invitations_workspace_status_idx" ON "workspace_invitations" ("workspace_id", "status");
CREATE INDEX IF NOT EXISTS "workspace_invitations_email_status_idx" ON "workspace_invitations" (lower("email"), "status");

CREATE TABLE IF NOT EXISTS "projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "name" text NOT NULL CHECK (char_length("name") BETWEEN 1 AND 120),
  "key" text NOT NULL CHECK ("key" ~ '^[A-Z][A-Z0-9]{1,9}$'),
  "description" text,
  "created_by" uuid NOT NULL REFERENCES auth.users(id),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "projects_workspace_key_unique" ON "projects" ("workspace_id", "key");
CREATE INDEX IF NOT EXISTS "projects_workspace_created_idx" ON "projects" ("workspace_id", "created_at");

CREATE TABLE IF NOT EXISTS "project_members" (
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "project_members_project_user_pk" PRIMARY KEY ("project_id", "user_id")
);
CREATE TABLE IF NOT EXISTS "audit_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "actor_id" uuid NOT NULL REFERENCES auth.users(id),
  "action" text NOT NULL,
  "target_type" text NOT NULL,
  "target_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "audit_records_workspace_created_idx" ON "audit_records" ("workspace_id", "created_at");

CREATE OR REPLACE FUNCTION public.is_workspace_member(target_workspace_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (
  SELECT 1 FROM public.workspace_memberships
  WHERE workspace_id = target_workspace_id AND user_id = auth.uid() AND status = 'active'
) $$;

CREATE OR REPLACE FUNCTION public.can_manage_workspace(target_workspace_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (
  SELECT 1 FROM public.workspace_memberships
  WHERE workspace_id = target_workspace_id AND user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
) $$;

GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_workspace(uuid) TO authenticated;

ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workspaces" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workspace_memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workspace_invitations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "project_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_records" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_self_select" ON "profiles";
CREATE POLICY "profiles_self_select" ON "profiles" FOR SELECT TO authenticated USING ("user_id" = auth.uid());
DROP POLICY IF EXISTS "workspaces_member_select" ON "workspaces";
CREATE POLICY "workspaces_member_select" ON "workspaces" FOR SELECT TO authenticated USING (public.is_workspace_member("id"));
DROP POLICY IF EXISTS "memberships_member_select" ON "workspace_memberships";
CREATE POLICY "memberships_member_select" ON "workspace_memberships" FOR SELECT TO authenticated USING (public.is_workspace_member("workspace_id"));
DROP POLICY IF EXISTS "invitations_manager_all" ON "workspace_invitations";
CREATE POLICY "invitations_manager_all" ON "workspace_invitations" FOR ALL TO authenticated USING (public.can_manage_workspace("workspace_id")) WITH CHECK (public.can_manage_workspace("workspace_id"));
DROP POLICY IF EXISTS "projects_member_select" ON "projects";
CREATE POLICY "projects_member_select" ON "projects" FOR SELECT TO authenticated USING (public.is_workspace_member("workspace_id"));
DROP POLICY IF EXISTS "project_members_member_select" ON "project_members";
CREATE POLICY "project_members_member_select" ON "project_members" FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND public.is_workspace_member(p.workspace_id))
);
DROP POLICY IF EXISTS "audit_member_select" ON "audit_records";
CREATE POLICY "audit_member_select" ON "audit_records" FOR SELECT TO authenticated USING (public.is_workspace_member("workspace_id"));
