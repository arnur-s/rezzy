begin;
select plan(18);
select ok(
  has_function_privilege('service_role', 'public.record_outbound_preflight_failure(uuid,text,text)', 'execute')
  and not has_function_privilege('authenticated', 'public.record_outbound_preflight_failure(uuid,text,text)', 'execute')
  and not has_function_privilege('anon', 'public.record_outbound_preflight_failure(uuid,text,text)', 'execute'),
  'only trusted senders may record preflight failure'
);
insert into auth.users (id, email, raw_user_meta_data)
values ('86000000-0000-4000-8000-000000000001', 'preflight-owner@example.com',
        '{"full_name":"Dispatch Owner"}'::jsonb);

insert into public.workspaces (id, name, created_by)
values ('86000000-0000-4000-8000-000000000002', 'Dispatch workspace',
        '86000000-0000-4000-8000-000000000001');

insert into public.channels (id, workspace_id, type, name)
values ('86000000-0000-4000-8000-000000000003',
        '86000000-0000-4000-8000-000000000002', 'telegram', 'Dispatch channel');

insert into public.contacts (id, workspace_id, name)
values ('86000000-0000-4000-8000-000000000004',
        '86000000-0000-4000-8000-000000000002', 'Dispatch contact');

insert into public.conversations (id, workspace_id, channel_id, contact_id)
values ('86000000-0000-4000-8000-000000000005',
        '86000000-0000-4000-8000-000000000002',
        '86000000-0000-4000-8000-000000000003',
        '86000000-0000-4000-8000-000000000004');

insert into public.messages (id, workspace_id, conversation_id, direction, sender_id, content)
values ('86000000-0000-4000-8000-000000000006',
        '86000000-0000-4000-8000-000000000002',
        '86000000-0000-4000-8000-000000000005', 'outbound',
        '86000000-0000-4000-8000-000000000001', 'Send once');


set local role authenticated;
select throws_ok(
  $$select public.record_outbound_preflight_failure('86000000-0000-4000-8000-000000000006','forged')$$,
  '42501', null, 'a browser cannot poison delivery status through the preflight helper'
);
set local role service_role;
select is(public.record_outbound_preflight_failure('86000000-0000-4000-8000-000000000099','missing'), false,
  'a missing message cannot produce failure history');
select is(public.record_outbound_preflight_failure('86000000-0000-4000-8000-000000000006','signed_url_failed','storage'), true,
  'a preflight failure before dispatch is recorded');
select is((select status from public.messages where id='86000000-0000-4000-8000-000000000006'), 'failed',
  'failure history projects the visible retryable state atomically');
select is((select error_code || ':' || error_type from public.message_status_events where message_id='86000000-0000-4000-8000-000000000006'),
  'signed_url_failed:storage', 'safe failure diagnostics are retained');
select is(public.record_outbound_preflight_failure('86000000-0000-4000-8000-000000000006','duplicate'), false,
  'another failed preflight cannot duplicate history');
select is((select count(*) from public.message_status_events where message_id='86000000-0000-4000-8000-000000000006'), 1::bigint,
  'only one history entry exists before retry');
select is(public.claim_outbound_message('86000000-0000-4000-8000-000000000006'), false,
  'failed preflight must be explicitly retried');
update public.messages set status='sent' where id='86000000-0000-4000-8000-000000000006';
select is(public.claim_outbound_message('86000000-0000-4000-8000-000000000006'), true,
  'an explicit retry can acquire dispatch');
select is(public.record_outbound_preflight_failure('86000000-0000-4000-8000-000000000006','late_failure'), false,
  'another request cannot fail an already claimed send');
select is((select status from public.messages where id='86000000-0000-4000-8000-000000000006'), 'sent',
  'in-flight delivery keeps its status');
select is((select count(*) from public.message_status_events where message_id='86000000-0000-4000-8000-000000000006'), 1::bigint,
  'a refused failure cannot append a projecting history entry');
select public.release_outbound_message('86000000-0000-4000-8000-000000000006');
update public.messages set status='sent' where id='86000000-0000-4000-8000-000000000006';
select is(public.record_outbound_preflight_failure('86000000-0000-4000-8000-000000000006','new_attempt_failed'), true,
  'after release an explicitly retried preflight may fail again');
select is(public.claim_outbound_message('86000000-0000-4000-8000-000000000006'), false,
  'the claim sees the new preflight failure');
update public.messages set status='delivered',external_id='accepted' where id='86000000-0000-4000-8000-000000000006';
select is(public.record_outbound_preflight_failure('86000000-0000-4000-8000-000000000006','late_failure'), false,
  'accepted provider messages cannot be marked failed by preflight');
select is((select status from public.messages where id='86000000-0000-4000-8000-000000000006'), 'delivered',
  'accepted status is preserved');
insert into public.messages(id,workspace_id,conversation_id,direction,content)
values('86000000-0000-4000-8000-000000000007','86000000-0000-4000-8000-000000000002','86000000-0000-4000-8000-000000000005','inbound','Received');
select is(public.record_outbound_preflight_failure('86000000-0000-4000-8000-000000000007','wrong_direction'), false,
  'inbound history is outside the sender boundary');
select * from finish();
rollback;
