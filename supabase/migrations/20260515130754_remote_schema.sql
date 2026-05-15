drop extension if exists "pg_net";

drop policy "Workspace members can delete channels" on "public"."channels";

drop policy "Workspace members can delete contact channels" on "public"."contact_channels";

drop policy "Workspace members can delete contacts" on "public"."contacts";

drop policy "Workspace members can delete conversations" on "public"."conversations";

drop policy "Workspace members can delete messages" on "public"."messages";

drop policy "Workspace creators and members can view workspaces" on "public"."workspaces";

drop policy "Workspace members can create contact channels" on "public"."contact_channels";

drop policy "Workspace members can update contact channels" on "public"."contact_channels";

drop policy "Workspace members can view contact channels" on "public"."contact_channels";

drop policy "Workspace members can create conversations" on "public"."conversations";

drop policy "Workspace members can update conversations" on "public"."conversations";

drop policy "Workspace creators can create owner membership" on "public"."workspace_members";

alter table "public"."workspace_members" drop constraint "workspace_members_workspace_user_key";

alter table "public"."workspaces" drop constraint "workspaces_slug_key";

alter table "public"."contacts" drop constraint "contacts_source_check";

alter table "public"."workspace_members" drop constraint "workspace_members_role_check";

alter table "public"."workspace_members" drop constraint "workspace_members_user_id_fkey";

alter table "public"."workspaces" drop constraint "workspaces_created_by_fkey";

drop function if exists "public"."increment_unread"(conversation_id uuid);

drop index if exists "public"."workspace_members_user_id_idx";

drop index if exists "public"."workspace_members_workspace_id_idx";

drop index if exists "public"."workspace_members_workspace_user_key";

drop index if exists "public"."workspaces_slug_key";

alter table "private"."channel_secrets" enable row level security;

alter table "public"."profiles" add column "updated_at" timestamp with time zone not null default now();

alter table "public"."workspace_members" add column "invited_by" uuid;

alter table "public"."workspace_members" alter column "role" drop default;

alter table "public"."workspaces" drop column "slug";

alter table "public"."workspaces" add column "deleted_at" timestamp with time zone;

alter table "public"."workspaces" add column "icon" text;

alter table "public"."workspaces" add column "updated_by" uuid;

alter table "public"."workspaces" alter column "created_by" set default auth.uid();

CREATE INDEX idx_workspace_members_user_id ON public.workspace_members USING btree (user_id);

CREATE INDEX idx_workspace_members_workspace_id ON public.workspace_members USING btree (workspace_id);

CREATE UNIQUE INDEX one_main_workspace_per_user ON public.workspaces USING btree (created_by) WHERE (is_main = true);

CREATE UNIQUE INDEX workspace_members_workspace_id_user_id_key ON public.workspace_members USING btree (workspace_id, user_id);

alter table "public"."workspace_members" add constraint "workspace_members_invited_by_fkey" FOREIGN KEY (invited_by) REFERENCES auth.users(id) not valid;

alter table "public"."workspace_members" validate constraint "workspace_members_invited_by_fkey";

alter table "public"."workspace_members" add constraint "workspace_members_workspace_id_user_id_key" UNIQUE using index "workspace_members_workspace_id_user_id_key";

alter table "public"."workspaces" add constraint "workspaces_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id) not valid;

alter table "public"."workspaces" validate constraint "workspaces_updated_by_fkey";

alter table "public"."contacts" add constraint "contacts_source_check" CHECK ((source = ANY (ARRAY['whatsapp'::text, 'instagram'::text, 'telegram'::text, 'email'::text, 'manual'::text]))) not valid;

alter table "public"."contacts" validate constraint "contacts_source_check";

alter table "public"."workspace_members" add constraint "workspace_members_role_check" CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text]))) not valid;

alter table "public"."workspace_members" validate constraint "workspace_members_role_check";

alter table "public"."workspace_members" add constraint "workspace_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."workspace_members" validate constraint "workspace_members_user_id_fkey";

alter table "public"."workspaces" add constraint "workspaces_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."workspaces" validate constraint "workspaces_created_by_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.auto_assign_conversation_on_outbound_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.direction = 'outbound' and new.sender_id is not null then
    update public.conversations
    set assigned_to = new.sender_id,
        updated_at = now()
    where id = new.conversation_id
      and workspace_id = new.workspace_id
      and assigned_to is null;
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_inbound_message_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.direction = 'inbound' THEN
    UPDATE public.conversations
    SET
      unread_count = coalesce(unread_count, 0) + 1,
      last_message_at = NEW.created_at,
      last_message_preview = coalesce(
        NEW.content,
        CASE NEW.type
          WHEN 'image' THEN '📷 Photo'
          WHEN 'video' THEN '🎥 Video'
          WHEN 'audio' THEN '🎧 Audio'
          WHEN 'voice' THEN '🎤 Voice message'
          WHEN 'document' THEN coalesce(NEW.media_filename, '📎 Document')
          WHEN 'sticker' THEN 'Sticker'
          ELSE 'Message'
        END
      ),
      updated_at = now()
    WHERE id = NEW.conversation_id;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_workspace()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner');
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_outbound_message_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.direction = 'outbound' then
    update public.conversations
    set
      unread_count = 0,
      assigned_to = coalesce(assigned_to, new.sender_id),
      last_message_at = new.created_at,
      last_message_preview = coalesce(nullif(trim(new.content), ''), 'Message'),
      updated_at = now()
    where id = new.conversation_id
      and workspace_id = new.workspace_id;
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.prevent_messages_for_inactive_channels()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if exists (
    select 1
    from public.conversations c
    join public.channels ch on ch.id = c.channel_id
    where c.id = new.conversation_id
      and ch.is_active = false
  ) then
    raise exception 'CHANNEL_INACTIVE';
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.soft_delete_workspace(p_workspace_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = p_workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.workspaces
  SET
    deleted_at = now(),
    updated_at = now(),
    updated_by = auth.uid()
  WHERE id = p_workspace_id
    AND deleted_at IS NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_contact_last_seen()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_contact_id uuid;
begin
  if new.direction <> 'inbound' then
    return null;
  end if;

  select contact_id into v_contact_id
  from public.conversations
  where id = new.conversation_id;

  update public.contacts
  set
    last_seen_at = greatest(coalesce(last_seen_at, new.created_at), new.created_at),
    updated_at = now()
  where id = v_contact_id;

  return null;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.ensure_message_sender_is_valid()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.direction = 'outbound' THEN
    IF NEW.sender_id IS NULL THEN
      RAISE EXCEPTION 'OUTBOUND_SENDER_REQUIRED'
        USING ERRCODE = '23502';
    END IF;

    IF auth.uid() IS NOT NULL AND NEW.sender_id <> auth.uid() THEN
      RAISE EXCEPTION 'OUTBOUND_SENDER_MUST_BE_CURRENT_USER'
        USING ERRCODE = '42501';
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_channel_credentials(p_channel_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
  SELECT credentials
  FROM private.channel_secrets
  WHERE channel_id = p_channel_id
$function$
;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id
      AND user_id = auth.uid()
  );
$function$
;

CREATE OR REPLACE FUNCTION public.upsert_channel_credentials(p_channel_id uuid, p_credentials jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
BEGIN
  INSERT INTO private.channel_secrets (channel_id, credentials)
  VALUES (p_channel_id, p_credentials)
  ON CONFLICT (channel_id)
  DO UPDATE SET credentials = EXCLUDED.credentials;
END;
$function$
;

grant delete on table "private"."channel_secrets" to "service_role";

grant insert on table "private"."channel_secrets" to "service_role";

grant select on table "private"."channel_secrets" to "service_role";

grant update on table "private"."channel_secrets" to "service_role";

grant delete on table "public"."conversation_reads" to "authenticated";

grant references on table "public"."conversation_reads" to "authenticated";

grant trigger on table "public"."conversation_reads" to "authenticated";

grant truncate on table "public"."conversation_reads" to "authenticated";


  create policy "Workspace admins can delete contact channels"
  on "public"."contact_channels"
  as permissive
  for delete
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = contact_channels.workspace_id) AND (wm.user_id = auth.uid()) AND (wm.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));



  create policy "Workspace admins can delete contacts"
  on "public"."contacts"
  as permissive
  for delete
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = contacts.workspace_id) AND (wm.user_id = auth.uid()) AND (wm.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));



  create policy "Workspace members can delete own read cursors"
  on "public"."conversation_reads"
  as permissive
  for delete
  to authenticated
using (((user_id = auth.uid()) AND public.is_workspace_member(workspace_id)));



  create policy "Workspace admins can delete conversations"
  on "public"."conversations"
  as permissive
  for delete
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = conversations.workspace_id) AND (wm.user_id = auth.uid()) AND (wm.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));



  create policy "Workspace admins can delete messages"
  on "public"."messages"
  as permissive
  for delete
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = messages.workspace_id) AND (wm.user_id = auth.uid()) AND (wm.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));



  create policy "Workspace admins can update active workspaces"
  on "public"."workspaces"
  as permissive
  for update
  to authenticated
using (((deleted_at IS NULL) AND (EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = workspaces.id) AND (wm.user_id = auth.uid()) AND (wm.role = ANY (ARRAY['owner'::text, 'admin'::text])))))))
with check ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = workspaces.id) AND (wm.user_id = auth.uid()) AND (wm.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));



  create policy "Workspace members can view active workspaces"
  on "public"."workspaces"
  as permissive
  for select
  to authenticated
using (((deleted_at IS NULL) AND public.is_workspace_member(id)));



  create policy "Workspace owners can delete workspaces"
  on "public"."workspaces"
  as permissive
  for delete
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = workspaces.id) AND (wm.user_id = auth.uid()) AND (wm.role = 'owner'::text)))));



  create policy "Workspace members can create contact channels"
  on "public"."contact_channels"
  as permissive
  for insert
  to authenticated
with check ((public.is_workspace_member(workspace_id) AND (EXISTS ( SELECT 1
   FROM public.contacts c
  WHERE ((c.id = contact_channels.contact_id) AND (c.workspace_id = contact_channels.workspace_id))))));



  create policy "Workspace members can update contact channels"
  on "public"."contact_channels"
  as permissive
  for update
  to authenticated
using (public.is_workspace_member(workspace_id))
with check ((public.is_workspace_member(workspace_id) AND (EXISTS ( SELECT 1
   FROM public.contacts c
  WHERE ((c.id = contact_channels.contact_id) AND (c.workspace_id = contact_channels.workspace_id))))));



  create policy "Workspace members can view contact channels"
  on "public"."contact_channels"
  as permissive
  for select
  to authenticated
using (public.is_workspace_member(workspace_id));



  create policy "Workspace members can create conversations"
  on "public"."conversations"
  as permissive
  for insert
  to authenticated
with check ((public.is_workspace_member(workspace_id) AND (EXISTS ( SELECT 1
   FROM public.contacts c
  WHERE ((c.id = conversations.contact_id) AND (c.workspace_id = conversations.workspace_id)))) AND (EXISTS ( SELECT 1
   FROM public.channels ch
  WHERE ((ch.id = conversations.channel_id) AND (ch.workspace_id = conversations.workspace_id))))));



  create policy "Workspace members can update conversations"
  on "public"."conversations"
  as permissive
  for update
  to authenticated
using (public.is_workspace_member(workspace_id))
with check ((public.is_workspace_member(workspace_id) AND (EXISTS ( SELECT 1
   FROM public.contacts c
  WHERE ((c.id = conversations.contact_id) AND (c.workspace_id = conversations.workspace_id)))) AND (EXISTS ( SELECT 1
   FROM public.channels ch
  WHERE ((ch.id = conversations.channel_id) AND (ch.workspace_id = conversations.workspace_id))))));



  create policy "Workspace creators can create owner membership"
  on "public"."workspace_members"
  as permissive
  for insert
  to authenticated
with check (((user_id = auth.uid()) AND (role = 'owner'::text) AND (EXISTS ( SELECT 1
   FROM public.workspaces w
  WHERE ((w.id = workspace_members.workspace_id) AND (w.created_by = auth.uid()))))));


CREATE TRIGGER trg_auto_assign_conversation_on_outbound_message AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.auto_assign_conversation_on_outbound_message();

CREATE TRIGGER trg_handle_inbound_message_insert AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.handle_inbound_message_insert();

CREATE TRIGGER trg_handle_outbound_message_insert AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.handle_outbound_message_insert();

CREATE TRIGGER trg_prevent_messages_for_inactive_channels BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.prevent_messages_for_inactive_channels();

CREATE TRIGGER trg_sync_contact_last_seen AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.sync_contact_last_seen();

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_workspace_created AFTER INSERT ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.handle_new_workspace();

CREATE TRIGGER workspaces_updated_at BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


