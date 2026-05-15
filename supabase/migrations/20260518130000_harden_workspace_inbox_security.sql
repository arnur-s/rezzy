-- Harden workspace inbox security
-- - Remove duplicated conversation_reads policies
-- - Revoke broad anon access
-- - Prevent sender spoofing for authenticated outbound messages
-- - Ensure assigned users belong to the workspace
-- - Optional realtime additions for contacts/contact_channels

BEGIN;

-- =========================================================
-- 1. Remove duplicated conversation_reads policies
-- =========================================================

DROP POLICY IF EXISTS "Workspace members can create own conversation reads"
ON public.conversation_reads;

DROP POLICY IF EXISTS "Workspace members can update own conversation reads"
ON public.conversation_reads;

DROP POLICY IF EXISTS "Workspace members can view own conversation reads"
ON public.conversation_reads;

DROP POLICY IF EXISTS "Workspace members can delete own conversation reads"
ON public.conversation_reads;


-- =========================================================
-- 2. Revoke broad anon privileges
-- =========================================================
-- RLS still protects rows, but anon should not receive broad object-level access
-- for a private CRM/CMS app.

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
REVOKE ALL ON TABLES FROM anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
REVOKE ALL ON FUNCTIONS FROM anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
REVOKE ALL ON SEQUENCES FROM anon;


-- =========================================================
-- 3. Tighten message sender rules
-- =========================================================
-- Current schema validates workspace access, but does not ensure sender_id
-- is the current authenticated user for outbound messages.
--
-- Since inbound messages should usually be inserted by Edge Functions using
-- service_role, authenticated users should only create outbound messages
-- as themselves.

DROP POLICY IF EXISTS "Workspace members can create messages"
ON public.messages;

CREATE POLICY "Workspace members can create outbound messages as themselves"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_workspace_member(workspace_id)
  AND direction = 'outbound'
  AND sender_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = messages.conversation_id
      AND c.workspace_id = messages.workspace_id
  )
);

DROP POLICY IF EXISTS "Workspace members can update messages"
ON public.messages;

CREATE POLICY "Workspace members can update workspace messages"
ON public.messages
FOR UPDATE
TO authenticated
USING (
  public.is_workspace_member(workspace_id)
)
WITH CHECK (
  public.is_workspace_member(workspace_id)
  AND EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = messages.conversation_id
      AND c.workspace_id = messages.workspace_id
  )
  AND (
    direction = 'inbound'
    OR sender_id = auth.uid()
  )
);


-- =========================================================
-- 4. Prevent invalid conversation assignees
-- =========================================================

CREATE OR REPLACE FUNCTION public.ensure_conversation_assignee_is_workspace_member()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      WHERE wm.workspace_id = NEW.workspace_id
        AND wm.user_id = NEW.assigned_to
    )
  THEN
    RAISE EXCEPTION 'ASSIGNEE_NOT_WORKSPACE_MEMBER'
      USING ERRCODE = '23503';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_conversation_assignee_is_workspace_member
ON public.conversations;

CREATE TRIGGER trg_ensure_conversation_assignee_is_workspace_member
BEFORE INSERT OR UPDATE OF assigned_to, workspace_id
ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.ensure_conversation_assignee_is_workspace_member();


-- =========================================================
-- 5. Prevent invalid outbound sender_id at DB level too
-- =========================================================
-- This gives protection even if future RLS policies change.

CREATE OR REPLACE FUNCTION public.ensure_message_sender_is_valid()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $$
BEGIN
  IF NEW.direction = 'outbound' THEN
    IF NEW.sender_id IS NULL THEN
      RAISE EXCEPTION 'OUTBOUND_SENDER_REQUIRED'
        USING ERRCODE = '23502';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      WHERE wm.workspace_id = NEW.workspace_id
        AND wm.user_id = NEW.sender_id
    ) THEN
      RAISE EXCEPTION 'SENDER_NOT_WORKSPACE_MEMBER'
        USING ERRCODE = '23503';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_message_sender_is_valid
ON public.messages;

CREATE TRIGGER trg_ensure_message_sender_is_valid
BEFORE INSERT OR UPDATE OF direction, sender_id, workspace_id
ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.ensure_message_sender_is_valid();


-- =========================================================
-- 6. Optional: add contacts/contact_channels to realtime
-- =========================================================
-- Useful if the contact panel or future contacts page should live-update.
-- Safe with RLS, but only keep if you actually need realtime contact updates.

ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contact_channels;


COMMIT;