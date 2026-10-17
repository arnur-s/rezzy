begin;
select plan(12);

select ok(
  has_function_privilege('service_role', 'public.reconcile_outbound_receipts(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.reconcile_outbound_receipts(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.reconcile_outbound_receipts(uuid)', 'execute'),
  'only trusted senders can reconcile provider receipts'
);

insert into auth.users (id, email, raw_user_meta_data)
values ('82000000-0000-4000-8000-000000000001', 'receipts@example.com', '{"full_name":"Receipt owner"}');
insert into public.workspaces (id, name, created_by)
values ('82000000-0000-4000-8000-000000000002', 'Receipt workspace', '82000000-0000-4000-8000-000000000001');
insert into public.channels (id, workspace_id, type, name)
values ('82000000-0000-4000-8000-000000000003', '82000000-0000-4000-8000-000000000002', 'whatsapp', 'WA'),
       ('82000000-0000-4000-8000-000000000004', '82000000-0000-4000-8000-000000000002', 'instagram', 'IG');
insert into public.contacts (id, workspace_id, name)
values ('82000000-0000-4000-8000-000000000005', '82000000-0000-4000-8000-000000000002', 'Receipt contact');
insert into public.conversations (id, workspace_id, channel_id, contact_id)
values ('82000000-0000-4000-8000-000000000006', '82000000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000003', '82000000-0000-4000-8000-000000000005'),
       ('82000000-0000-4000-8000-000000000007', '82000000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000004', '82000000-0000-4000-8000-000000000005');
insert into public.messages (id, workspace_id, conversation_id, direction, sender_id, content, external_id)
values ('82000000-0000-4000-8000-000000000008', '82000000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000006', 'outbound', '82000000-0000-4000-8000-000000000001', 'WA reply', null),
       ('82000000-0000-4000-8000-000000000009', '82000000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000007', 'outbound', '82000000-0000-4000-8000-000000000001', 'IG reply', null);

insert into public.provider_events (id, workspace_id, channel_id, provider, event_type, event_fingerprint, payload, status)
values ('82000000-0000-4000-8000-000000000011', '82000000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000003', 'whatsapp', 'status', 'status:shared-id:read', '{"id":"shared-id","status":"read"}', 'processing'),
       ('82000000-0000-4000-8000-000000000012', '82000000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000004', 'instagram', 'read', 'read:person:shared-id', '{"read":{"mid":"shared-id"}}', 'processed'),
       ('82000000-0000-4000-8000-000000000013', '82000000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000003', 'whatsapp', 'status', 'status:shared-id:unknown', '{"id":"shared-id","status":{"bad":"shape"}}', 'ignored');

set local role service_role;
select is(public.reconcile_outbound_receipts('82000000-0000-4000-8000-000000000008'), 0::bigint, 'no receipt attaches before the provider id is known');
update public.messages set external_id = 'shared-id' where id = '82000000-0000-4000-8000-000000000008';
select is(public.reconcile_outbound_receipts('82000000-0000-4000-8000-000000000008'), 1::bigint, 'an early processing receipt attaches after the accepted id is saved');
select is((select status from public.messages where id = '82000000-0000-4000-8000-000000000008'), 'read', 'replayed receipt advances the visible delivery status');
select is(public.reconcile_outbound_receipts('82000000-0000-4000-8000-000000000008'), 0::bigint, 'replay is idempotent even for receipts without timestamps');
select throws_ok(
  $$insert into public.message_status_events (workspace_id, message_id, provider_event_id, status)
    values ('82000000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000008',
            '82000000-0000-4000-8000-000000000011', 'read')$$,
  '23505', null, 'a direct callback cannot duplicate an already replayed receipt with a null timestamp'
);
select is((select status from public.provider_events where id = '82000000-0000-4000-8000-000000000011'), 'processing', 'replay leaves webhook ledger ownership untouched');
select is((select count(*) from public.message_status_events where message_id = '82000000-0000-4000-8000-000000000008'), 1::bigint, 'another provider/channel sharing the external id is not attached');

update public.messages set external_id = 'shared-id' where id = '82000000-0000-4000-8000-000000000009';
select is(public.reconcile_outbound_receipts('82000000-0000-4000-8000-000000000009'), 1::bigint, 'an Instagram read previously acknowledged without a target is recovered');
select is((select status from public.messages where id = '82000000-0000-4000-8000-000000000009'), 'read', 'Instagram status advances after reconciliation');

insert into public.provider_events (workspace_id, channel_id, provider, event_type, event_fingerprint, payload, status)
values ('82000000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000003', 'whatsapp', 'status', 'status:shared-id:delivered', '{"id":"shared-id","status":"delivered"}', 'ignored');
select is(public.reconcile_outbound_receipts('82000000-0000-4000-8000-000000000008'), 1::bigint, 'a late delivered receipt is preserved in history');
select is((select status from public.messages where id = '82000000-0000-4000-8000-000000000008'), 'read', 'late delivery cannot regress a read receipt');

select * from finish();
rollback;
