#!/usr/bin/env bash
# Real two-session regressions against this project's local database only.
set -euo pipefail

cd "$(dirname "$0")/../../.."
project_id=$(sed -n 's/^project_id[[:space:]]*=[[:space:]]*"\([A-Za-z0-9_-]*\)".*/\1/p' supabase/config.toml)
if [[ -z "$project_id" || "$project_id" == *$'\n'* ]]; then
  echo 'race.sh: expected one simple project_id in supabase/config.toml' >&2
  exit 1
fi
DB_CONTAINER="supabase_db_$project_id"
if [[ "$(docker inspect --format '{{.State.Running}}' "$DB_CONTAINER")" != true ]]; then
  echo "race.sh: local container $DB_CONTAINER is not running" >&2
  exit 1
fi
DB=(docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -qtAX -v ON_ERROR_STOP=1)
WS=70000000-0000-4000-8000-000000000001
OWNER_A=70000000-0000-4000-8000-000000000011
OWNER_B=70000000-0000-4000-8000-000000000012
ADMIN=70000000-0000-4000-8000-000000000013
TARGET=70000000-0000-4000-8000-000000000014
INVITEE=70000000-0000-4000-8000-000000000015
CONTACT=70000000-0000-4000-8000-000000000021
CHANNEL=70000000-0000-4000-8000-000000000031
CONVERSATION=70000000-0000-4000-8000-000000000041
MESSAGE=70000000-0000-4000-8000-000000000051
RUN_ID="rezzy_race_$$"
GATE_KEY=70820176
scratch=$(mktemp -d)

check() {
  if [[ "$2" != "$3" ]]; then
    echo "not ok - $1 (got '$2', want '$3')" >&2
    exit 1
  fi
  echo "ok - $1"
}

claims() { printf "set local role authenticated; set local request.jwt.claims = '{\"sub\":\"%s\",\"role\":\"authenticated\"}';" "$1"; }

teardown() {
  "${DB[@]}" >/dev/null <<SQL
delete from public.messages where workspace_id = '$WS';
delete from public.conversations where workspace_id = '$WS';
delete from public.contacts where workspace_id = '$WS';
delete from public.channels where workspace_id = '$WS';
delete from public.workspace_invitations where workspace_id = '$WS';
delete from public.workspace_members where workspace_id = '$WS';
delete from public.workspaces where id = '$WS';
delete from auth.users where id in ('$OWNER_A','$OWNER_B','$ADMIN','$TARGET','$INVITEE');
SQL
}

cleanup() {
  local result=$?
  trap - EXIT
  # Terminate only sessions created by this invocation, including a gate left
  # behind by an assertion failure. Then cleanup cannot wait on their row locks.
  "${DB[@]}" -c "select pg_terminate_backend(pid) from pg_stat_activity where application_name like '${RUN_ID}_%';" >/dev/null 2>&1 || result=1
  teardown || result=1
  rm -f "$scratch"/*
  rmdir "$scratch"
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

seed() {
  teardown
  "${DB[@]}" >/dev/null <<SQL
insert into auth.users (id, email, raw_user_meta_data) values
  ('$OWNER_A', 'race-owner-a@example.com', '{"full_name":"Race Owner A"}'),
  ('$OWNER_B', 'race-owner-b@example.com', '{"full_name":"Race Owner B"}'),
  ('$ADMIN', 'race-admin@example.com', '{"full_name":"Race Admin"}'),
  ('$TARGET', 'race-target@example.com', '{"full_name":"Race Target"}'),
  ('$INVITEE', 'race-invitee@example.com', '{"full_name":"Race Invitee"}');
insert into public.workspaces (id, name, created_by) values ('$WS', 'Race Workspace', '$OWNER_A');
insert into public.workspace_members (workspace_id, user_id, role) values
  ('$WS', '$OWNER_B', 'owner'), ('$WS', '$ADMIN', 'admin'), ('$WS', '$TARGET', 'member');
insert into public.contacts (id, workspace_id, name) values ('$CONTACT', '$WS', 'Race Customer');
SQL
}

# A separate backend holds an advisory gate. A executes its write and then
# blocks at that gate with its transaction open. Only after observing B waiting
# for A's row/unique-index lock do we release the gate. Polling observes database
# state; timing does not decide which operation wins.
wait_for() {
  local query=$1
  for ((attempt=0; attempt<150; attempt++)); do
    if [[ "$("${DB[@]}" -c "$query")" == t ]]; then return; fi
    sleep 0.1
  done
  echo 'race.sh: timed out waiting for the database interleaving' >&2
  cat "$scratch"/*.log >&2
  exit 1
}

race() {
  local first=$1 second=$2 expected_error=${3:-}
  "${DB[@]}" -c "set application_name='${RUN_ID}_gate'; select pg_advisory_lock($GATE_KEY); select pg_sleep(45);" >"$scratch/gate.log" 2>&1 &
  local gate_pid=$!
  wait_for "select exists(select 1 from pg_stat_activity where application_name='${RUN_ID}_gate' and wait_event='PgSleep');"
  "${DB[@]}" -c "set application_name='${RUN_ID}_a'; begin; $first select pg_advisory_lock($GATE_KEY); commit;" >"$scratch/a.log" 2>&1 &
  local a_pid=$!
  wait_for "select exists(select 1 from pg_stat_activity where application_name='${RUN_ID}_a' and wait_event='advisory');"
  "${DB[@]}" -c "set application_name='${RUN_ID}_b'; begin; $second commit;" >"$scratch/b.log" 2>&1 &
  local b_pid=$!
  wait_for "select exists(select 1 from pg_stat_activity where application_name='${RUN_ID}_b' and wait_event_type='Lock');"
  "${DB[@]}" -c "select pg_terminate_backend(pid) from pg_stat_activity where application_name='${RUN_ID}_gate';" >/dev/null
  # The gate is intentionally terminated. All workload process statuses are
  # checked; an unrelated SQL error must never look like a passing race.
  wait "$gate_pid" 2>/dev/null || true
  if ! wait "$a_pid"; then cat "$scratch/a.log" >&2; exit 1; fi
  if wait "$b_pid"; then
    if [[ -n "$expected_error" ]]; then
      echo "race.sh: expected $expected_error, but the second writer succeeded" >&2
      exit 1
    fi
  elif [[ -z "$expected_error" ]] || ! grep -q "ERROR:  $expected_error" "$scratch/b.log"; then
    cat "$scratch/b.log" >&2
    exit 1
  fi
}

seed
race "$(claims "$OWNER_A") select public.update_workspace_member_role('$WS','$OWNER_A','member');" \
     "$(claims "$OWNER_B") select public.update_workspace_member_role('$WS','$OWNER_B','member');" LAST_OWNER
check 'concurrent demotions retain one owner' "$("${DB[@]}" -c "select count(*) from public.workspace_members where workspace_id='$WS' and role='owner';")" 1

seed
race "$(claims "$OWNER_A") select public.remove_workspace_member('$WS','$OWNER_A');" \
     "$(claims "$OWNER_B") select public.remove_workspace_member('$WS','$OWNER_B');" LAST_OWNER
check 'concurrent self-removals retain one owner' "$("${DB[@]}" -c "select count(*) from public.workspace_members where workspace_id='$WS' and role='owner';")" 1

seed
race "$(claims "$OWNER_A") select public.update_workspace_member_role('$WS','$TARGET','owner');" \
     "$(claims "$ADMIN") select public.update_workspace_member_role('$WS','$TARGET','admin');" OWNER_ROLE_REQUIRES_OWNER
check 'an admin cannot overwrite a concurrent promotion to owner' "$("${DB[@]}" -c "select role from public.workspace_members where workspace_id='$WS' and user_id='$TARGET';")" owner

seed
race "$(claims "$OWNER_A") select public.update_workspace_member_role('$WS','$OWNER_B','member');" \
     "$(claims "$OWNER_B") select public.update_workspace_member_role('$WS','$TARGET','owner');" NOT_A_WORKSPACE_ADMIN
check 'a caller demoted while waiting cannot grant owner' "$("${DB[@]}" -c "select role from public.workspace_members where workspace_id='$WS' and user_id='$TARGET';")" member

seed
race "$(claims "$OWNER_A") select public.remove_workspace_member('$WS','$ADMIN');" \
     "$(claims "$ADMIN") select public.remove_workspace_member('$WS','$TARGET');" NOT_A_WORKSPACE_ADMIN
check 'a caller removed while waiting cannot remove someone else' "$("${DB[@]}" -c "select count(*) from public.workspace_members where workspace_id='$WS' and user_id='$TARGET';")" 1

seed
race "$(claims "$OWNER_A") select public.invite_workspace_member('$WS','race-invitee@example.com','member');" \
     "$(claims "$OWNER_B") select public.invite_workspace_member('$WS','race-invitee@example.com','admin');"
check 'both concurrent invites succeed and share one pending row' "$("${DB[@]}" -c "select count(*) from public.workspace_invitations where workspace_id='$WS' and status='pending';")" 1

invitation_id=$("${DB[@]}" -c "select id from public.workspace_invitations where workspace_id='$WS' and status='pending';")
race "$(claims "$INVITEE") select public.respond_to_workspace_invitation('$invitation_id',true);" \
     "$(claims "$INVITEE") select public.respond_to_workspace_invitation('$invitation_id',true);" INVITATION_NOT_FOUND
check 'two accepting tabs create exactly one membership' "$("${DB[@]}" -c "select count(*) from public.workspace_members where workspace_id='$WS' and user_id='$INVITEE';")" 1

seed
race "$(claims "$OWNER_A") select * from public.set_contact_phones('$WS','$CONTACT',array['+77011111111']);" \
     "$(claims "$OWNER_B") select * from public.set_contact_phones('$WS','$CONTACT',array['+77012222222']);"
check 'a concurrent replacement keeps only the second requested phone set' "$("${DB[@]}" -c "select string_agg(phone,',' order by position) from public.contact_phones where contact_id='$CONTACT';")" +77012222222
check 'the primary matches that complete set' "$("${DB[@]}" -c "select phone from public.contacts where id='$CONTACT';")" +77012222222

seed_outbound() {
  seed
  "${DB[@]}" >/dev/null <<SQL
insert into public.channels (id, workspace_id, type) values ('$CHANNEL', '$WS', 'telegram');
insert into public.conversations (id, workspace_id, contact_id, channel_id) values ('$CONVERSATION','$WS','$CONTACT','$CHANNEL');
insert into public.messages (id, workspace_id, conversation_id, direction, sender_id, content)
values ('$MESSAGE','$WS','$CONVERSATION','outbound','$OWNER_A','Send once');
SQL
}

seed_outbound
race "set local role service_role; select public.claim_outbound_message('$MESSAGE');" \
     "set local role service_role; select public.claim_outbound_message('$MESSAGE');"
check 'the first provider dispatch owns the claim' "$(grep -c '^t$' "$scratch/a.log")" 1
check 'a simultaneous provider dispatch is refused' "$(grep -c '^f$' "$scratch/b.log")" 1
check 'one durable fence survives both dispatch attempts' "$("${DB[@]}" -c "select count(*) from private.outbound_message_dispatches where message_id='$MESSAGE';")" 1

seed_outbound
race "set local role service_role; select public.claim_outbound_message('$MESSAGE');" \
     "set local role service_role; select public.record_outbound_preflight_failure('$MESSAGE','late_failure');"
check 'a concurrent preflight failure refuses an owned dispatch' "$(grep -c '^f$' "$scratch/b.log")" 1
check 'the in-flight message remains sent' "$("${DB[@]}" -c "select status from public.messages where id='$MESSAGE';")" sent
check 'refused preflight adds no projecting history' "$("${DB[@]}" -c "select count(*) from public.message_status_events where message_id='$MESSAGE';")" 0

seed_outbound
race "set local role service_role; select public.record_outbound_preflight_failure('$MESSAGE','signed_url_failed');" \
     "set local role service_role; select public.claim_outbound_message('$MESSAGE');"
check 'preflight failure wins before a competing dispatch' "$(grep -c '^t$' "$scratch/a.log")" 1
check 'a competing dispatch observes the committed failure' "$(grep -c '^f$' "$scratch/b.log")" 1
check 'preflight preserves the retryable failed state' "$("${DB[@]}" -c "select status from public.messages where id='$MESSAGE';")" failed
check 'no delivery fence is left by a failed preflight' "$("${DB[@]}" -c "select count(*) from private.outbound_message_dispatches where message_id='$MESSAGE';")" 0

echo 'all race tests passed'
