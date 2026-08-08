begin;

-- get_whatsapp_channel_by_phone() is the routing decision for every inbound
-- WhatsApp webhook, and it is `limit 1` with no `order by` over
-- idx_channel_secrets_wa_phone, which is not unique. If two channels ever held
-- the same credentials->>'phone_number_id', which channel won would be a planner
-- detail -- and it could change between calls. The same customer's messages
-- would land in one workspace or another depending on the plan, which is a
-- cross-workspace disclosure dressed up as a routing bug.
--
-- Checked on the linked project before adding this: 5 credential rows, 1 with a
-- non-empty WhatsApp phone_number_id, 1 distinct value, 0 duplicates. Nothing
-- needed repairing, so the index goes on as-is.
--
-- Scoped to non-empty values. NULLs are already distinct under SQL uniqueness,
-- so channels with no phone_number_id at all (every non-WhatsApp channel) would
-- not collide -- but an empty string would, and '' is what a partially filled
-- credentials blob leaves behind. The predicate excludes both.
--
-- Uniqueness is deliberately not restricted to type = 'whatsapp'. A partial
-- index cannot reach across to public.channels, and the value is a Meta phone
-- number id: if it appeared on two channels of any type, the lookup would still
-- be ambiguous for the one that filters on 'whatsapp'.
create unique index if not exists uq_channel_secrets_wa_phone
  on private.channel_secrets ((credentials->>'phone_number_id'))
  where nullif(credentials->>'phone_number_id', '') is not null;

-- idx_channel_secrets_wa_phone stays, and is not redundant. The unique index
-- above is partial, and the planner cannot prove that the parameter in
-- `credentials->>'phone_number_id' = p_phone_number_id` is non-empty, so it
-- cannot use it for the lookup. The partial index is the constraint; the plain
-- index is still the read path.
--
-- get_whatsapp_channel_by_phone() itself is left alone: with at most one row per
-- phone_number_id its `limit 1` is now deterministic rather than arbitrary.

commit;
