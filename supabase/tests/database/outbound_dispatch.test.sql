begin;

select plan(16);

select ok(
  has_function_privilege('service_role', 'public.claim_outbound_message(uuid)', 'execute')
  and has_function_privilege('service_role', 'public.release_outbound_message(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.claim_outbound_message(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.release_outbound_message(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.claim_outbound_message(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.release_outbound_message(uuid)', 'execute'),
  'only trusted send functions may claim or release a dispatch'
);

select ok(
  not has_table_privilege('authenticated', 'private.outbound_message_dispatches', 'select,insert,update,delete')
  and not has_table_privilege('anon', 'private.outbound_message_dispatches', 'select,insert,update,delete'),
  'browser roles cannot inspect or remove the dispatch fence'
);

insert into auth.users (id, email, raw_user_meta_data)
values ('81000000-0000-4000-8000-000000000001', 'dispatch-owner@example.com',
        '{"full_name":"Dispatch Owner"}'::jsonb);

insert into public.workspaces (id, name, created_by)
values ('81000000-0000-4000-8000-000000000002', 'Dispatch workspace',
        '81000000-0000-4000-8000-000000000001');

insert into public.channels (id, workspace_id, type, name)
values ('81000000-0000-4000-8000-000000000003',
        '81000000-0000-4000-8000-000000000002', 'telegram', 'Dispatch channel');

insert into public.contacts (id, workspace_id, name)
values ('81000000-0000-4000-8000-000000000004',
        '81000000-0000-4000-8000-000000000002', 'Dispatch contact');

insert into public.conversations (id, workspace_id, channel_id, contact_id)
values ('81000000-0000-4000-8000-000000000005',
        '81000000-0000-4000-8000-000000000002',
        '81000000-0000-4000-8000-000000000003',
        '81000000-0000-4000-8000-000000000004');

insert into public.messages (id, workspace_id, conversation_id, direction, sender_id, content)
values ('81000000-0000-4000-8000-000000000006',
        '81000000-0000-4000-8000-000000000002',
        '81000000-0000-4000-8000-000000000005', 'outbound',
        '81000000-0000-4000-8000-000000000001', 'Send once');

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok(
  $$ select public.claim_outbound_message('81000000-0000-4000-8000-000000000006') $$,
  '42501', null, 'a workspace owner cannot bypass the edge dispatch boundary'
);

reset role;
set local request.jwt.claims = '{}';
set local role service_role;

select is(public.claim_outbound_message('81000000-0000-4000-8000-000000000099'),
          false, 'missing messages cannot be claimed');
select is(public.claim_outbound_message('81000000-0000-4000-8000-000000000006'),
          true, 'the first dispatch claims the message');
select is(public.claim_outbound_message('81000000-0000-4000-8000-000000000006'),
          false, 'another dispatch cannot send the same message');

reset role;
update private.outbound_message_dispatches
set claimed_at = now() - interval '1 day';
set local role service_role;

select is(public.claim_outbound_message('81000000-0000-4000-8000-000000000006'),
          false, 'an ambiguous old dispatch never expires into a duplicate send');

select lives_ok(
  $$ select public.release_outbound_message('81000000-0000-4000-8000-000000000006') $$,
  'a definite provider rejection can release the claim'
);
select is((select status from public.messages where id = '81000000-0000-4000-8000-000000000006'),
          'failed', 'release marks the message failed in the same transaction');
select is(public.claim_outbound_message('81000000-0000-4000-8000-000000000006'),
          false, 'a failed message must be explicitly retried');

update public.messages set status = 'sent'
where id = '81000000-0000-4000-8000-000000000006';
select is(public.claim_outbound_message('81000000-0000-4000-8000-000000000006'),
          true, 'an explicit retry after a definite failure may claim again');

update public.messages set external_id = 'provider-delivered-id'
where id = '81000000-0000-4000-8000-000000000006';
select public.release_outbound_message('81000000-0000-4000-8000-000000000006');
select is((select status from public.messages where id = '81000000-0000-4000-8000-000000000006'),
          'sent', 'a late release cannot mark a delivered message as failed');
select is(public.claim_outbound_message('81000000-0000-4000-8000-000000000006'),
          false, 'a provider-confirmed message cannot be dispatched again');

insert into public.messages (id, workspace_id, conversation_id, direction, sender_id, content)
values ('81000000-0000-4000-8000-000000000007',
        '81000000-0000-4000-8000-000000000002',
        '81000000-0000-4000-8000-000000000005', 'outbound',
        '81000000-0000-4000-8000-000000000001', 'Route checks');
update public.channels set is_active = false
where id = '81000000-0000-4000-8000-000000000003';
select is(public.claim_outbound_message('81000000-0000-4000-8000-000000000007'),
          false, 'inactive channels cannot start a dispatch');

update public.channels set is_active = true
where id = '81000000-0000-4000-8000-000000000003';
update public.conversations set deleted_at = now()
where id = '81000000-0000-4000-8000-000000000005';
select is(public.claim_outbound_message('81000000-0000-4000-8000-000000000007'),
          false, 'archived conversations cannot start a dispatch');

reset role;
select is((select count(*)::integer from private.outbound_message_dispatches),
          1, 'the successful dispatch fence is retained after a late release');

select * from finish();
rollback;
