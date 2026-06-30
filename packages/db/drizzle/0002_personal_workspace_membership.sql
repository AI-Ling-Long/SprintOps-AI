-- Personal workspaces always have exactly one active owner: personal_owner_id.
DELETE FROM workspace_memberships membership
USING workspaces workspace
WHERE membership.workspace_id = workspace.id
  AND workspace.type = 'personal'
  AND membership.user_id <> workspace.personal_owner_id;

UPDATE workspace_memberships membership
SET role = 'owner', status = 'active', updated_at = now()
FROM workspaces workspace
WHERE membership.workspace_id = workspace.id
  AND workspace.type = 'personal'
  AND membership.user_id = workspace.personal_owner_id;

CREATE OR REPLACE FUNCTION public.enforce_personal_workspace_membership()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE
  workspace_type workspace_type;
  owner_id uuid;
BEGIN
  SELECT type, personal_owner_id INTO workspace_type, owner_id
  FROM workspaces WHERE id = COALESCE(NEW.workspace_id, OLD.workspace_id);

  IF workspace_type = 'personal' THEN
    IF TG_OP = 'DELETE' OR NEW.user_id <> owner_id OR NEW.role <> 'owner' OR NEW.status <> 'active' THEN
      RAISE EXCEPTION 'personal workspace membership is fixed' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS enforce_personal_workspace_membership_trigger ON workspace_memberships;
CREATE TRIGGER enforce_personal_workspace_membership_trigger
BEFORE INSERT OR UPDATE OR DELETE ON workspace_memberships
FOR EACH ROW EXECUTE FUNCTION public.enforce_personal_workspace_membership();

CREATE OR REPLACE FUNCTION public.reject_personal_workspace_invitation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM workspaces WHERE id = NEW.workspace_id AND type = 'personal') THEN
    RAISE EXCEPTION 'personal workspaces cannot have invitations' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reject_personal_workspace_invitation_trigger ON workspace_invitations;
CREATE TRIGGER reject_personal_workspace_invitation_trigger
BEFORE INSERT OR UPDATE ON workspace_invitations
FOR EACH ROW EXECUTE FUNCTION public.reject_personal_workspace_invitation();
