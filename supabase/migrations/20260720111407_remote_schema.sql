set check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(new.email, '@', 1), ''),
      'New user'
    ),
    coalesce(new.email, '')
  )
  on conflict (id) do update
    set
      full_name = excluded.full_name,
      email = excluded.email;

  return new;
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

CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_conversation_id uuid, p_last_read_message_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := auth.uid();
  target_workspace_id uuid;
begin
  if current_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select c.workspace_id
    into target_workspace_id
  from public.conversations c
  where c.id = p_conversation_id;

  if target_workspace_id is null then
    raise exception 'Conversation not found' using errcode = 'P0002';
  end if;

  if not public.is_workspace_member(target_workspace_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_last_read_message_id is not null
    and not exists (
      select 1
      from public.messages m
      where m.id = p_last_read_message_id
        and m.conversation_id = p_conversation_id
        and m.workspace_id = target_workspace_id
    )
  then
    raise exception 'Read cursor message does not belong to conversation'
      using errcode = '23503';
  end if;

  insert into public.conversation_reads (
    workspace_id,
    conversation_id,
    user_id,
    last_read_message_id,
    last_read_at
  )
  values (
    target_workspace_id,
    p_conversation_id,
    current_user_id,
    p_last_read_message_id,
    now()
  )
  on conflict (conversation_id, user_id)
  do update
    set
      workspace_id = excluded.workspace_id,
      last_read_message_id = excluded.last_read_message_id,
      last_read_at = now();

  update public.conversations
  set unread_count = 0
  where id = p_conversation_id;
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


