begin;

-- Every outbound message ran two AFTER INSERT triggers that both assigned the
-- conversation, so a single send produced two UPDATEs on public.conversations
-- and two realtime broadcasts to every subscriber of the inbox list. The list
-- re-sorted twice per sent message.
--
-- The two are equivalent, despite differently shaped predicates. Both fire
-- AFTER INSERT ON public.messages FOR EACH ROW, both match the same row
-- (id = new.conversation_id and workspace_id = new.workspace_id), and both are
-- gated on direction = 'outbound':
--
--   auto_assign_conversation_on_outbound_message
--     ... set assigned_to = new.sender_id where assigned_to is null,
--     additionally gated on new.sender_id is not null
--
--   handle_outbound_message_insert
--     ... set assigned_to = coalesce(assigned_to, new.sender_id)
--
-- Case by case, final value of assigned_to, with both triggers versus with
-- handle_outbound_message_insert alone:
--
--   assigned_to already set  -> auto-assign's `where assigned_to is null`
--                               matches nothing; coalesce keeps the existing
--                               assignee. Same either way.
--   assigned_to null,        -> auto-assign writes sender_id, then coalesce
--   sender_id present           keeps it. Alone, coalesce(null, sender_id)
--                               writes the same value. Same either way.
--   assigned_to null,        -> auto-assign is skipped, coalesce(null, null)
--   sender_id null              is null. Same either way -- and unreachable:
--                               ensure_message_sender_is_valid raises
--                               OUTBOUND_SENDER_REQUIRED for an outbound row
--                               with no sender.
--
-- Firing order is not load-bearing either. Same-timing triggers fire in name
-- order, so today the sequence is trg_auto_assign_... , then
-- trg_create_message_notifications, then trg_handle_inbound_message_insert,
-- then trg_handle_outbound_message_insert. The only one of those that reads
-- conversations.assigned_to is trg_create_message_notifications, and it returns
-- immediately unless direction = 'inbound' -- the branch that never coincides
-- with either assign. Nothing observes the intermediate state, so moving the
-- assignment later in the sequence changes nothing.
--
-- handle_outbound_message_insert is the one kept: it also maintains
-- last_message_at and last_message_preview, so it has to run regardless, and
-- folding the assignment into the UPDATE it already performs is what removes
-- the second statement.

drop trigger if exists trg_auto_assign_conversation_on_outbound_message
  on public.messages;

drop function if exists public.auto_assign_conversation_on_outbound_message();

commit;
